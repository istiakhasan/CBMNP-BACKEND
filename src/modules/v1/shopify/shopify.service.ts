import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Products } from '../order/entities/products.entity';
import { Order } from '../order/entities/order.entity';
import { Repository, IsNull, Not } from 'typeorm';
import { generateUniqueOrderNumber } from '../../../util/genarateUniqueNumber';
import { Shopify } from './entities/shopify.entity';
import { Product } from '../product/entity/product.entity';
import { ProductImages } from '../product/entity/image.entity';
import { Customers, CustomerType } from '../customers/entities/customers.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { OrderService } from '../order/order.service';

@Injectable()
export class ShopifyWebhookService {
  private readonly logger = new Logger(ShopifyWebhookService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Products)
    private readonly productRepository: Repository<Products>,
    @InjectRepository(Product)
    private readonly productCatalogRepository: Repository<Product>,
    @InjectRepository(ProductImages)
    private readonly productImagesRepository: Repository<ProductImages>,
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
    @InjectRepository(Shopify)
    private readonly shopifyRepository: Repository<Shopify>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly orderService: OrderService, 
  ) {}

  // ---------- HMAC ----------
  async verifyShopifyWebhookSignature(body: string, shopifyHmac: string, shopDomain: string) {
    const shop = await this.shopifyRepository.findOne({ where: { domain: shopDomain } });
    if (!shop || !shop.secret || !shopifyHmac) {
      return { valid: false, shop: null };
    }
    const calculatedHmac = crypto.createHmac('sha256', shop.secret).update(body, 'utf8').digest('base64');
    return { valid: this.timingSafeEqual(calculatedHmac, shopifyHmac), shop };
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // ---------- ORDER WEBHOOK (Shopify → ERP) ----------
  async handleShopifyOrderWebhook(body: string, shopifyHmac: string, shopDomain: string, webhookId?: string) {
    const { valid, shop } = await this.verifyShopifyWebhookSignature(body, shopifyHmac, shopDomain);
    if (!valid) throw new BadRequestException('Invalid webhook signature');
    if (!shop) throw new BadRequestException('Shop not configured');

    const webhookData = JSON.parse(body);

   if (webhookId) {
  const existing = await this.orderRepository.findOne({
    where: { shopifyOrderId: String(webhookData.id), organizationId: shop.organizationId },
  });
  if (existing) {
    this.logger.log(`Duplicate webhook for order ${webhookData.name}, skipping`);
    return { skipped: true, orderId: existing.id };
  }
}

    const customer = await this.resolveOrCreateCustomer(webhookData, shop.organizationId);

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
const defaultWarehouse = await this.warehouseRepository.findOne({
    where: { organizationId: shop.organizationId, isDefault: true },
  });
  // ✅ একই generator, তাই format সবজায়গায় same (ORD-XXXXX)
const orderNumber = await this.orderService.generateOrderNumber(shop.organizationId);
const invoiceNumber = await this.orderService.generateInvoiceNumber(shop.organizationId);
    try {
      const result = await this.orderRepository.save({
        locationId: defaultWarehouse.id,
        customerId: customer.customer_Id,
        receiverPhoneNumber: webhookData.shipping_address?.phone,
        receiverName: webhookData.shipping_address?.name,
        statusId: 1,
        totalPrice: totalAmount,
        paymentMethod: webhookData.payment_gateway_names?.join(', '),
        receiverDivision: webhookData.shipping_address?.province,
        receiverDistrict: webhookData.shipping_address?.city,
        receiverThana: '',
        receiverAddress: webhookData.shipping_address?.address1,
        products,

        shippingCharge,
           orderNumber, // ✅ এখন ORD-10001 ফরম্যাট, Shopify এর #1307 না
    invoiceNumber, // ✅ org এর prefix দিয়ে (TB-0001)
    shopifyOrderName: webhookData.name,
        productValue,
        orderSource: 'Shopify',
        organizationId: shop.organizationId,
        totalReceiveAbleAmount: totalAmount,
        discount: parseFloat(webhookData.total_discounts_set?.shop_money?.amount || '0'),
        paymentStatus: webhookData.financial_status,
        onCancelReason: webhookData.cancel_reason,
        shopifyOrderId: String(webhookData.id),
      });

      this.logger.log(`Order saved: ${result.id} (${result.orderNumber}), customer: ${customer.customer_Id}`);
      return { orderId: result.id, orderNumber: result.orderNumber };
    } catch (error: any) {
      this.logger.error(`Error saving Shopify order: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to save order');
    }
  }

  // ---------- CUSTOMER resolve/create ----------
  private async resolveOrCreateCustomer(webhookData: any, organizationId: string): Promise<Customers> {
    const shopifyCustomer = webhookData.customer;
    const shopifyCustomerId = shopifyCustomer?.id ? String(shopifyCustomer.id) : null;
    const phone =
      webhookData.shipping_address?.phone ||
      webhookData.billing_address?.phone ||
      shopifyCustomer?.phone ||
      null;

    let customer: Customers | null = null;

    if (shopifyCustomerId) {
      customer = await this.customerRepository.findOne({
        where: { shopifyCustomerId, organizationId },
      });
    }

    if (!customer && phone) {
      customer = await this.customerRepository.findOne({
        where: { customerPhoneNumber: phone, organizationId },
      });
      if (customer && shopifyCustomerId && !customer.shopifyCustomerId) {
        customer = await this.customerRepository.save({ ...customer, shopifyCustomerId });
      }
    }

    if (customer) return customer;

    const name =
      webhookData.shipping_address?.name ||
      `${shopifyCustomer?.first_name || ''} ${shopifyCustomer?.last_name || ''}`.trim() ||
      'Shopify Customer';

    customer = await this.customerRepository.save({
      customerName: name,
      customerPhoneNumber: phone || '',
      address: webhookData.shipping_address?.address1 || '',
      division: webhookData.shipping_address?.province || '',
      district: webhookData.shipping_address?.city || '',
      thana: '',
      country: webhookData.shipping_address?.country || 'Bangladesh',
      customerType: CustomerType.NonProbashi,
      customer_Id: await this.generateUniqueCustomerId(organizationId),
      organizationId,
      shopifyCustomerId,
    });

    this.logger.log(`New customer auto-created from Shopify order: ${customer.customer_Id}`);
    return customer;
  }

  private async generateUniqueCustomerId(organizationId: string): Promise<string> {
    const lastCustomer = await this.customerRepository.findOne({
      where: { organizationId },
      order: { id: 'DESC' },
    });
    const lastNumber = lastCustomer?.customer_Id?.replace('CUS-', '');
    const nextNumber = lastNumber && !isNaN(Number(lastNumber)) ? Number(lastNumber) + 1 : 10000;
    return `CUS-${nextNumber}`;
  }

  // ---------- PRODUCT resolve/create (order webhook থেকে) ----------
  /**
   * শুধু local catalog এ খোঁজে — না পেলে line item data দিয়ে bare-bones product বানায়
   * (image ছাড়া — products/create বা products/update webhook এলে auto-fill হবে)
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
    if (product) return product;

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

    this.logger.log(`New product auto-created from order (no image yet): ${product.id}`);
    return product;
  }

  // ---------- PRODUCT WEBHOOK (products/create, products/update) — image-এর একমাত্র উৎস ----------
  async handleShopifyProductWebhook(body: string, shopifyHmac: string, shopDomain: string) {
    const { valid, shop } = await this.verifyShopifyWebhookSignature(body, shopifyHmac, shopDomain);
    if (!valid) throw new BadRequestException('Invalid webhook signature');
    if (!shop) throw new BadRequestException('Shop not configured');

    const shopifyProduct = JSON.parse(body);
    const saved = await this.upsertProductFromShopifyData(shopifyProduct, shop.organizationId);
    return { productId: saved.id };
  }

  private async upsertProductFromShopifyData(shopifyProduct: any, organizationId: string): Promise<Product> {
    const shopifyProductId = String(shopifyProduct.id);
    const variants = shopifyProduct.variants?.length ? shopifyProduct.variants : [{}];

    let lastSaved: Product;

    for (const variant of variants) {
      const shopifyVariantId = variant.id ? String(variant.id) : null;

      let existing = shopifyVariantId
        ? await this.productCatalogRepository.findOne({ where: { shopifyVariantId, organizationId } })
        : await this.productCatalogRepository.findOne({ where: { shopifyProductId, organizationId } });

      const productData = {
        name: variants.length > 1 ? `${shopifyProduct.title} - ${variant.title}` : shopifyProduct.title,
        sku: variant.sku || '',
        description: this.stripHtml(shopifyProduct.body_html || ''),
        active: shopifyProduct.status === 'active',
        weight: String(variant.grams ?? variant.weight ?? 0),
        unit: variant.weight_unit || 'g',
        organizationId,
        productType: 'Simple product' as const,
        regularPrice: parseFloat(variant.compare_at_price || variant.price || '0'),
        salePrice: parseFloat(variant.price || '0'),
        retailPrice: parseFloat(variant.price || '0'),
        distributionPrice: parseFloat(variant.price || '0'),
        purchasePrice: 0,
        shopifyProductId,
        shopifyVariantId,
      };

      if (existing) {
        lastSaved = await this.productCatalogRepository.save({ ...existing, ...productData });
        this.logger.log(`Product updated from Shopify: ${lastSaved.id}`);
      } else {
        lastSaved = await this.productCatalogRepository.save(productData);
        this.logger.log(`Product created from Shopify: ${lastSaved.id}`);
      }

      const relevantImages = variant.image_id
        ? shopifyProduct.images?.filter((img: any) => img.id === variant.image_id)
        : shopifyProduct.images;

      await this.syncProductImages(lastSaved.id, relevantImages?.length ? relevantImages : shopifyProduct.images || []);
    }

    return lastSaved;
  }

  private async syncProductImages(productId: string, shopifyImages: any[]) {
    if (!shopifyImages?.length) {
      this.logger.debug(`No images to sync for product ${productId}`);
      return;
    }

    try {
      const existingImages = await this.productImagesRepository.find({ where: { productId } });
      const existingUrls = new Set(existingImages.map((img) => img.url));

      for (const img of shopifyImages) {
        if (img.src && !existingUrls.has(img.src)) {
          await this.productImagesRepository.save({
            url: img.src,
            delete_url: img.src,
            productId,
          });
          this.logger.debug(`Image saved for product ${productId}: ${img.src}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Image sync failed for product ${productId}: ${err.message}`, err.stack);
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  async handleShopifyProductDeleteWebhook(body: string, shopifyHmac: string, shopDomain: string) {
    const { valid, shop } = await this.verifyShopifyWebhookSignature(body, shopifyHmac, shopDomain);
    if (!valid) throw new BadRequestException('Invalid webhook signature');
    if (!shop) throw new BadRequestException('Shop not configured');

    const data = JSON.parse(body);
    await this.productCatalogRepository.update(
      { shopifyProductId: String(data.id), organizationId: shop.organizationId },
      { active: false },
    );
    return { deactivated: String(data.id) };
  }

  async configureShopify(data: Shopify) {
    return this.shopifyRepository.save(data);
  }

  // ---------- HELPER: কোন Shopify product গুলোর image মিসিং তার লিস্ট ----------
  /**
   * Admin panel-এ দেখানোর জন্য — merchant কে বলে দেওয়া যায় ঠিক কোন product গুলো
   * Shopify-তে গিয়ে একবার re-save/publish করতে হবে যাতে image sync হয়।
   */
  async getProductsMissingImages(organizationId: string) {
    const products = await this.productCatalogRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .where('product.organizationId = :organizationId', { organizationId })
      .andWhere('product.shopifyProductId IS NOT NULL')
      .getMany();

    const missing = products.filter((p) => !p.images || p.images.length === 0);

    return {
      total: missing.length,
      products: missing.map((p) => ({
        id: p.id,
        name: p.name,
        shopifyProductId: p.shopifyProductId,
        shopifyAdminUrl: null, // নিচে shop domain দিয়ে বসিয়ে দিচ্ছি controller-এ
      })),
    };
  }
}