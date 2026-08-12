import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Products } from '../order/entities/products.entity';
import { Order } from '../order/entities/order.entity';
import { Repository } from 'typeorm';
import { generateUniqueOrderNumber } from '../../../util/genarateUniqueNumber';
import { Shopify } from './entities/shopify.entity';
import { Product } from '../product/entity/product.entity';

@Injectable()
export class ShopifyWebhookService {
  private readonly logger = new Logger(ShopifyWebhookService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Products)
    private readonly productRepository: Repository<Products>, // order line-item entity
    @InjectRepository(Product)
    private readonly productCatalogRepository: Repository<Product>, // আসল product catalog
    @InjectRepository(Shopify)
    private readonly shopifyRepository: Repository<Shopify>,
  ) {}

  async verifyShopifyWebhookSignature(
    body: string,
    shopifyHmac: string,
    shopDomain: string,
  ): Promise<{ valid: boolean; shop: Shopify | null }> {
    const shop = await this.shopifyRepository.findOne({ where: { domain: shopDomain } });
    if (!shop || !shop.secret || !shopifyHmac) {
      return { valid: false, shop: null };
    }

    const calculatedHmac = crypto
      .createHmac('sha256', shop.secret)
      .update(body, 'utf8')
      .digest('base64');

    // timing-safe compare — string === string HMAC compare timing attack এর জন্য vulnerable
    const isValid = this.timingSafeEqual(calculatedHmac, shopifyHmac);
    return { valid: isValid, shop };
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  async handleShopifyOrderWebhook(
    body: string,
    shopifyHmac: string,
    shopDomain: string,
    webhookId?: string,
  ) {
    // 1. HMAC verify + shop resolve একই কলে (duplicate lookup এড়াতে)
    const { valid, shop } = await this.verifyShopifyWebhookSignature(body, shopifyHmac, shopDomain);

    if (!valid) {
      throw new BadRequestException('Invalid webhook signature');
    }
    if (!shop) {
      throw new BadRequestException('Shop not configured');
    }

    const webhookData = JSON.parse(body);

    // 2. Idempotency check — Shopify webhook-id দিয়ে duplicate delivery ঠেকাও
    if (webhookId) {
      const existing = await this.orderRepository.findOne({
        where: { orderNumber: webhookData.name, organizationId: shop.organizationId },
      });
      if (existing) {
        this.logger.log(`Duplicate webhook for order ${webhookData.name}, skipping`);
        return { skipped: true, orderId: existing.id };
      }
    }

    // 3. প্রতিটা line item এর জন্য প্রোডাক্ট resolve/create করো
    const products = [];
    if (webhookData.line_items?.length > 0) {
      for (const lineItem of webhookData.line_items) {
        const catalogProduct = await this.resolveOrCreateProduct(lineItem, shop.organizationId);

        products.push({
          productId: catalogProduct.id,
          productQuantity: lineItem.quantity,
          productPrice: parseFloat(lineItem.price || '0'),
          subtotal: parseFloat(lineItem.price || '0') * lineItem.quantity,
        });
      }
    }

    const shippingCharge = parseFloat(webhookData.total_shipping_price_set?.shop_money?.amount || '0');
    const productValue = parseFloat(webhookData.total_line_items_price_set?.shop_money?.amount || '0');
    const totalAmount = productValue + shippingCharge;

    try {
      const result = await this.orderRepository.save({
        receiverPhoneNumber: webhookData.shipping_address?.phone,
        receiverName: webhookData.shipping_address?.name,
        statusId: 1,
        totalPrice: totalAmount,
        paymentMethod: webhookData.payment_gateway_names?.join(', '),
        receiverDivision: webhookData.shipping_address?.province,
        receiverDistrict: webhookData.shipping_address?.city,
        receiverThana: '', // "string" placeholder বাদ দিলাম — এটা bug ছিল
        receiverAddress: webhookData.shipping_address?.address1,
        products,
        orderNumber: webhookData.name || generateUniqueOrderNumber(),
        shippingCharge,
        productValue,
        orderSource: 'Shopify',
        organizationId: shop.organizationId,
        totalReceiveAbleAmount: totalAmount,
        discount: parseFloat(webhookData.total_discounts_set?.shop_money?.amount || '0'),
        paymentStatus: webhookData.financial_status,
        onCancelReason: webhookData.cancel_reason,
      });

      this.logger.log(`Order saved: ${result.id} (${result.orderNumber})`);
      return { orderId: result.id, orderNumber: result.orderNumber };
    } catch (error:any) {
      this.logger.error(`Error saving Shopify order: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to save order');
    }
  }

  /**
   * Shopify line item অনুযায়ী local product catalog থেকে খুঁজে বের করে,
   * না পেলে নতুন product + inventory তৈরি করে।
   */
  private async resolveOrCreateProduct(lineItem: any, organizationId: string): Promise<Product> {
    const shopifyVariantId = lineItem.variant_id ? String(lineItem.variant_id) : null;
    const shopifyProductId = lineItem.product_id ? String(lineItem.product_id) : null;

    let product: Product | null = null;

    if (shopifyVariantId) {
      product = await this.productCatalogRepository.findOne({
        where: { shopifyVariantId, organizationId },
      });
    }

    if (!product && shopifyProductId) {
      product = await this.productCatalogRepository.findOne({
        where: { shopifyProductId, organizationId },
      });
    }

    if (product) {
      return product;
    }

    // নতুন product তৈরি করো
    product = await this.productCatalogRepository.save({
      name: lineItem.name || lineItem.title || 'Untitled Shopify Product',
      sku: lineItem.sku || '',
      description: lineItem.title || '',
      active: true,
      weight: String(lineItem.grams ?? 0),
      unit: 'g',
      organizationId,
      productType: 'Simple product',
      regularPrice: parseFloat(lineItem.price || '0'),
      salePrice: parseFloat(lineItem.price || '0'),
      retailPrice: parseFloat(lineItem.price || '0'),
      distributionPrice: parseFloat(lineItem.price || '0'),
      purchasePrice: 0,
      shopifyProductId,
      shopifyVariantId,
    });

    this.logger.log(`New product auto-created from Shopify: ${product.id} (${product.name})`);

    // Inventory তে zero-stock entry খুলে রাখো, পরে stock sync/adjustment হবে
    // Inventory entity/repository তোমার actual field অনুযায়ী adjust করো
    // await this.inventoryRepository.save({
    //   product: { id: product.id },
    //   organizationId,
    //   quantity: 0,
    // });

    return product;
  }

  async configureShopify(data: Shopify) {
    const result = await this.shopifyRepository.save(data);
    return result;
  }
}