import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Products } from '../order/entities/products.entity';
import { Order } from '../order/entities/order.entity';
import { Repository, IsNull, Not } from 'typeorm';
import { Shopify } from './entities/shopify.entity';
import { Product } from '../product/entity/product.entity';
import { ProductImages } from '../product/entity/image.entity';
import {
  Customers,
  CustomerType,
} from '../customers/entities/customers.entity';
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
  async verifyShopifyWebhookSignature(
    body: string,
    shopifyHmac: string,
    shopDomain: string,
  ) {
    const shop = await this.shopifyRepository.findOne({
      where: { domain: shopDomain },
    });
    if (!shop || !shop.secret || !shopifyHmac) {
      return { valid: false, shop: null };
    }
    const calculatedHmac = crypto
      .createHmac('sha256', shop.secret)
      .update(body, 'utf8')
      .digest('base64');
    return { valid: this.timingSafeEqual(calculatedHmac, shopifyHmac), shop };
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // =====================================================================
  // ORDER WEBHOOK — পুরো method একটাই try/catch এ, কোনো লাইনেই crash হলে
  // unhandled exception হবে না, আর warehouse missing থাকলেও order block হবে না।
  // =====================================================================
  async handleShopifyOrderWebhook(
    body: string,
    shopifyHmac: string,
    shopDomain: string,
    webhookId?: string,
  ) {
    const { valid, shop } = await this.verifyShopifyWebhookSignature(
      body,
      shopifyHmac,
      shopDomain,
    );
    if (!valid) throw new BadRequestException('Invalid webhook signature');
    if (!shop) throw new BadRequestException('Shop not configured');

    const webhookData = JSON.parse(body);
    const shopifyOrderId = String(webhookData.id);

    this.logger.log(
      `Webhook received: order ${webhookData.name} (${shopifyOrderId}) for shop ${shopDomain}`,
    );

    try {
      // ---- dedup check ----
      const existing = await this.orderRepository.findOne({
        where: { shopifyOrderId, organizationId: shop.organizationId },
      });
      if (existing) {
        this.logger.log(
          `Duplicate webhook for order ${webhookData.name}, skipping`,
        );
        return { skipped: true, orderId: existing.id };
      }

      // ---- retry wrapper diye actual processing (transient DB error handle korar jonno) ----
      const result = await this.processOrderWithRetry(
        webhookData,
        shop.organizationId,
      );

      this.logger.log(`Order saved: ${result.orderId} (${result.orderNumber})`);
      return result;
    } catch (error: any) {
      // ei catch-e sob kisu dhora porbe: warehouse null, customer/product error,
      // lock timeout (3 retry er porew fail korle), duplicate key — SOB.
      this.logger.error(
        `FAILED processing Shopify order ${webhookData.name} (${shopifyOrderId}) for shop ${shopDomain}: ${error.message}`,
        error.stack,
      );
      // non-2xx return korchi jate Shopify nijeo webhook retry kore (extra safety net)
      throw new InternalServerErrorException(
        'Failed to save order, will be retried',
      );
    }
  }

  // ---- Core processing, transient error hole automatic retry (max 3 bar, backoff shoho) ----
  private async processOrderWithRetry(
    webhookData: any,
    organizationId: string,
    attempt = 1,
  ): Promise<{ orderId: string; orderNumber: string }> {
    const MAX_ATTEMPTS = 3;
    try {
      return await this.processOrder(webhookData, organizationId);
    } catch (error: any) {
      const isTransient =
        error?.code === '40P01' || // deadlock_detected
        error?.code === '55P03' || // lock_not_available
        /deadlock|lock|timeout/i.test(error?.message || '');

      if (isTransient && attempt < MAX_ATTEMPTS) {
        const delay = attempt * 500; // 500ms, 1000ms
        this.logger.warn(
          `Transient error on order ${webhookData.name}, attempt ${attempt}, retrying in ${delay}ms: ${error.message}`,
        );
        await new Promise((res) => setTimeout(res, delay));
        return this.processOrderWithRetry(
          webhookData,
          organizationId,
          attempt + 1,
        );
      }
      throw error;
    }
  }

  private async processOrder(
    webhookData: any,
    organizationId: string,
  ): Promise<{ orderId: string; orderNumber: string }> {
    const customer = await this.resolveOrCreateCustomer(
      webhookData,
      organizationId,
    );

    const products = [];
    if (webhookData.line_items?.length > 0) {
      for (const lineItem of webhookData.line_items) {
        const catalogProduct = await this.resolveOrCreateProduct(
          lineItem,
          organizationId,
        );
        products.push({
          productId: catalogProduct.id,
          productQuantity: lineItem.quantity,
          productPrice: parseFloat(lineItem.price || '0'),
          subtotal: parseFloat(lineItem.price || '0') * lineItem.quantity,
        });
      }
    }

    const shippingCharge = parseFloat(
      webhookData.total_shipping_price_set?.shop_money?.amount || '0',
    );
    const productValue = parseFloat(
      webhookData.total_line_items_price_set?.shop_money?.amount || '0',
    );
    const totalAmount = productValue + shippingCharge;

    // ✅ SELF-HEALING WAREHOUSE — এইটাই মূল fix, আর কখনো `.id of null` crash হবে না
    const warehouseId =
      await this.getOrCreateFallbackWarehouseId(organizationId);

    const orderNumber =
      await this.orderService.generateOrderNumber(organizationId);
    const invoiceNumber =
      await this.orderService.generateInvoiceNumber(organizationId);

    const result = await this.orderRepository.save({
      locationId: warehouseId,
      customerId: customer.customer_Id,
      receiverPhoneNumber:
        webhookData.shipping_address?.phone ||
        webhookData.billing_address?.phone ||
        '',
      receiverName:
        webhookData.shipping_address?.name ||
        webhookData.billing_address?.name ||
        customer.customerName,
      statusId: 1,
      totalPrice: totalAmount,
      paymentMethod: webhookData.payment_gateway_names?.join(', ') || 'Shopify',
      receiverDivision: webhookData.shipping_address?.province || '',
      receiverDistrict: webhookData.shipping_address?.city || '',
      receiverThana: '',
      receiverAddress: webhookData.shipping_address?.address1 || '',
      products,
      shippingCharge,
      orderNumber,
      invoiceNumber,
      shopifyOrderName: webhookData.name,
      productValue,
      orderSource: 'Shopify',
      organizationId,
      totalReceiveAbleAmount: totalAmount,
      discount: parseFloat(
        webhookData.total_discounts_set?.shop_money?.amount || '0',
      ),
      paymentStatus: webhookData.financial_status,
      onCancelReason: webhookData.cancel_reason,
      shopifyOrderId: String(webhookData.id),
    });

    return { orderId: String(result.id), orderNumber: result.orderNumber };
  }

  // ---- Warehouse resolve: default > any active warehouse > auto-create placeholder ----
  // Ei function-i guarantee dey je locationId kokhono null hobe na, order kokhono
  // "warehouse nai" bole atke thakbe na.
  private async getOrCreateFallbackWarehouseId(
    organizationId: string,
  ): Promise<string> {
    let warehouse = await this.warehouseRepository.findOne({
      where: { organizationId, isDefault: true },
    });
    if (warehouse) return warehouse.id;

    // default nai, kintu onno kono warehouse ache kina dekhi
    warehouse = await this.warehouseRepository.findOne({
      where: { organizationId },
      order: { id: 'ASC' as any },
    });
    if (warehouse) {
      this.logger.warn(
        `No default warehouse for org ${organizationId}, falling back to warehouse ${warehouse.id}. Please set a default warehouse in admin panel.`,
      );
      return warehouse.id;
    }

    // kono warehouse-i nai — ekta placeholder auto-create kore dei, order jeno block na hoy
    this.logger.warn(
      `No warehouse at all for org ${organizationId}. Auto-creating fallback "Unassigned" warehouse.`,
    );
    try {
      const created = await this.warehouseRepository.save({
        organizationId,
        name: 'Unassigned (auto-created)',
        isDefault: true,
      } as any);
      return created.id;
    } catch (err: any) {
      // race condition: eki shomoy e onno request-o warehouse create korte pare
      if (/duplicate key|unique constraint/i.test(err.message)) {
        const retryFind = await this.warehouseRepository.findOne({
          where: { organizationId },
        });
        if (retryFind) return retryFind.id;
      }
      throw err;
    }
  }

  // ---------- CUSTOMER resolve/create ----------
  private async resolveOrCreateCustomer(
    webhookData: any,
    organizationId: string,
  ): Promise<Customers> {
    const shopifyCustomer = webhookData.customer;
    const shopifyCustomerId = shopifyCustomer?.id
      ? String(shopifyCustomer.id)
      : null;
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
        customer = await this.customerRepository.save({
          ...customer,
          shopifyCustomerId,
        });
      }
    }

    if (customer) return customer;

    const name =
      webhookData.shipping_address?.name ||
      `${shopifyCustomer?.first_name || ''} ${shopifyCustomer?.last_name || ''}`.trim() ||
      'Shopify Customer';

    try {
      customer = await this.customerRepository.save({
        customerName: name,
        customerPhoneNumber: phone || '',
        division: webhookData.shipping_address?.province || '',
        district: webhookData.shipping_address?.city || '',
        thana: '',
        country: webhookData.shipping_address?.country || 'Bangladesh',
        customerType: CustomerType.NonProbashi,
        customer_Id: await this.generateUniqueCustomerId(organizationId),
        organizationId,
        shopifyCustomerId,
      });
    } catch (err: any) {
      // duplicate customer_Id race condition hole ekbar notun id niye retry
      if (/duplicate key|unique constraint/i.test(err.message)) {
        customer = await this.customerRepository.save({
          customerName: name,
          customerPhoneNumber: phone || '',
          division: webhookData.shipping_address?.province || '',
          district: webhookData.shipping_address?.city || '',
          thana: '',
          country: webhookData.shipping_address?.country || 'Bangladesh',
          customerType: CustomerType.NonProbashi,
          customer_Id: await this.generateUniqueCustomerId(organizationId),
          organizationId,
          shopifyCustomerId,
        });
      } else {
        throw err;
      }
    }

    this.logger.log(
      `New customer auto-created from Shopify order: ${customer.customer_Id}`,
    );
    return customer;
  }

  private async generateUniqueCustomerId(
    organizationId: string,
  ): Promise<string> {
    const lastCustomer = await this.customerRepository.findOne({
      where: { organizationId },
      order: { id: 'DESC' },
    });
    const lastNumber = lastCustomer?.customer_Id?.replace('CUS-', '');
    const nextNumber =
      lastNumber && !isNaN(Number(lastNumber)) ? Number(lastNumber) + 1 : 10000;
    return `CUS-${nextNumber}`;
  }

  // ---------- PRODUCT resolve/create (order webhook থেকে) ----------
  private async resolveOrCreateProduct(
    lineItem: any,
    organizationId: string,
  ): Promise<Product> {
    const shopifyVariantId = lineItem.variant_id
      ? String(lineItem.variant_id)
      : null;
    const shopifyProductId = lineItem.product_id
      ? String(lineItem.product_id)
      : null;

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

    try {
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
    } catch (err: any) {
      // race condition: products/create webhook eki shomoy e already create kore fele thakte pare
      if (/duplicate key|unique constraint/i.test(err.message)) {
        product = shopifyVariantId
          ? await this.productCatalogRepository.findOne({
              where: { shopifyVariantId, organizationId },
            })
          : await this.productCatalogRepository.findOne({
              where: { shopifyProductId, organizationId },
            });
        if (product) return product;
      }
      throw err;
    }

    this.logger.log(
      `New product auto-created from order (no image yet): ${product.id}`,
    );
    return product;
  }

  // ---------- PRODUCT WEBHOOK (products/create, products/update) — image-এর একমাত্র উৎস ----------
  async handleShopifyProductWebhook(
    body: string,
    shopifyHmac: string,
    shopDomain: string,
  ) {
    const { valid, shop } = await this.verifyShopifyWebhookSignature(
      body,
      shopifyHmac,
      shopDomain,
    );
    if (!valid) throw new BadRequestException('Invalid webhook signature');
    if (!shop) throw new BadRequestException('Shop not configured');

    const shopifyProduct = JSON.parse(body);
    try {
      const saved = await this.upsertProductFromShopifyData(
        shopifyProduct,
        shop.organizationId,
      );
      return { productId: saved.id };
    } catch (error: any) {
      this.logger.error(
        `Product webhook processing failed for ${shopifyProduct?.id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to process product webhook',
      );
    }
  }

  private async upsertProductFromShopifyData(
    shopifyProduct: any,
    organizationId: string,
  ): Promise<Product> {
    const shopifyProductId = String(shopifyProduct.id);
    const variants = shopifyProduct.variants?.length
      ? shopifyProduct.variants
      : [{}];

    let lastSaved: Product;

    for (const variant of variants) {
      const shopifyVariantId = variant.id ? String(variant.id) : null;

      let existing = shopifyVariantId
        ? await this.productCatalogRepository.findOne({
            where: { shopifyVariantId, organizationId },
          })
        : await this.productCatalogRepository.findOne({
            where: { shopifyProductId, organizationId },
          });

      const productData = {
        name:
          variants.length > 1
            ? `${shopifyProduct.title} - ${variant.title}`
            : shopifyProduct.title,
        sku: variant.sku || '',
        description: this.stripHtml(shopifyProduct.body_html || ''),
        active: shopifyProduct.status === 'active',
        weight: String(variant.grams ?? variant.weight ?? 0),
        unit: variant.weight_unit || 'g',
        organizationId,
        productType: 'Simple product' as const,
        regularPrice: parseFloat(
          variant.compare_at_price || variant.price || '0',
        ),
        salePrice: parseFloat(variant.price || '0'),
        retailPrice: parseFloat(variant.price || '0'),
        distributionPrice: parseFloat(variant.price || '0'),
        purchasePrice: 0,
        shopifyProductId,
        shopifyVariantId,
      };

      if (existing) {
        lastSaved = await this.productCatalogRepository.save({
          ...existing,
          ...productData,
        });
        this.logger.log(`Product updated from Shopify: ${lastSaved.id}`);
      } else {
        lastSaved = await this.productCatalogRepository.save(productData);
        this.logger.log(`Product created from Shopify: ${lastSaved.id}`);
      }

      const relevantImages = variant.image_id
        ? shopifyProduct.images?.filter(
            (img: any) => img.id === variant.image_id,
          )
        : shopifyProduct.images;

      await this.syncProductImages(
        lastSaved.id,
        relevantImages?.length ? relevantImages : shopifyProduct.images || [],
      );
    }

    return lastSaved;
  }

  private async syncProductImages(productId: string, shopifyImages: any[]) {
    if (!shopifyImages?.length) {
      this.logger.debug(`No images to sync for product ${productId}`);
      return;
    }

    try {
      const existingImages = await this.productImagesRepository.find({
        where: { productId },
      });
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
      this.logger.error(
        `Image sync failed for product ${productId}: ${err.message}`,
        err.stack,
      );
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  async handleShopifyProductDeleteWebhook(
    body: string,
    shopifyHmac: string,
    shopDomain: string,
  ) {
    const { valid, shop } = await this.verifyShopifyWebhookSignature(
      body,
      shopifyHmac,
      shopDomain,
    );
    if (!valid) throw new BadRequestException('Invalid webhook signature');
    if (!shop) throw new BadRequestException('Shop not configured');

    const data = JSON.parse(body);
    await this.productCatalogRepository.update(
      {
        shopifyProductId: String(data.id),
        organizationId: shop.organizationId,
      },
      { active: false },
    );
    return { deactivated: String(data.id) };
  }

  async configureShopify(data: Shopify) {
    return this.shopifyRepository.save(data);
  }

  // ---------- HELPER: কোন Shopify product গুলোর image মিসিং তার লিস্ট ----------
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
        shopifyAdminUrl: null,
      })),
    };
  }
}
 