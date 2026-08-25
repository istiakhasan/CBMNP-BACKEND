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

// Postgres unique_violation error code — used everywhere we need to detect
// a duplicate-key race instead of pattern-matching error.message (locale/driver safe).
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: any): boolean {
  return (
    err?.code === PG_UNIQUE_VIOLATION ||
    /duplicate key|unique constraint/i.test(err?.message || '')
  );
}

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
  private normalizeBangladeshPhone(phone?: string | null): string {
  if (!phone) return '';

  const value = String(phone).trim();

  // Already Bangladesh local number.
  // IMPORTANT: return immediately, do not modify it.
  if (/^01\d{9}$/.test(value)) {
    return value;
  }

  // +88001XXXXXXXXX -> 01XXXXXXXXX
  if (/^\+88001\d{9}$/.test(value)) {
    return value.substring(3);
  }

  // 88001XXXXXXXXX -> 01XXXXXXXXX
  if (/^88001\d{9}$/.test(value)) {
    return value.substring(3);
  }

  // +8801XXXXXXXXX -> 01XXXXXXXXX
  if (/^\+8801\d{9}$/.test(value)) {
    return `0${value.substring(4)}`;
  }

  // 8801XXXXXXXXX -> 01XXXXXXXXX
  if (/^8801\d{9}$/.test(value)) {
    return `0${value.substring(3)}`;
  }

  // 1XXXXXXXXX -> 01XXXXXXXXX
  if (/^1\d{9}$/.test(value)) {
    return `0${value}`;
  }

  // Other country / unknown format → preserve original
  return value;
}
  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // =====================================================================
  // ORDER WEBHOOK
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

    let webhookData: any;
    try {
      webhookData = JSON.parse(body);
    } catch (err: any) {
      this.logger.error(
        `Invalid JSON body received for shop ${shopDomain}: ${err.message}`,
      );
      throw new BadRequestException('Invalid webhook payload');
    }

    const shopifyOrderId = String(webhookData.id);

    this.logger.log(
      `Webhook received: order ${webhookData.name} (${shopifyOrderId}) for shop ${shopDomain}`,
    );

    try {
      // ---- dedup check (best-effort; final safety net is the DB unique constraint below) ----
      const existing = await this.orderRepository.findOne({
        where: { shopifyOrderId, organizationId: shop.organizationId },
      });
      if (existing) {
        this.logger.log(
          `Duplicate webhook for order ${webhookData.name}, skipping`,
        );
        return { skipped: true, orderId: existing.id };
      }

      const result = await this.processOrderWithRetry(
        webhookData,
        shop.organizationId,
      );

      this.logger.log(`Order saved: ${result.orderId} (${result.orderNumber})`);
      return result;
    } catch (error: any) {
      // Two concurrent deliveries of the SAME order (Shopify redelivery, or
      // multiple pm2/cluster workers) can both pass the dedup SELECT above
      // before either INSERT commits. The DB unique constraint on
      // shopifyOrderId is what actually prevents the duplicate row — this
      // is expected and NOT a real failure, so we resolve it gracefully
      // instead of bubbling up a 500 (which would just make Shopify retry
      // and spam error logs/alerts for something that already succeeded).
      if (
        isUniqueViolation(error) &&
        /shopifyOrderId|shopify_order/i.test(
          error?.detail || error?.message || '',
        )
      ) {
        const existing = await this.orderRepository.findOne({
          where: { shopifyOrderId, organizationId: shop.organizationId },
        });
        if (existing) {
          this.logger.log(
            `Order ${webhookData.name} was saved by a concurrent request, skipping`,
          );
          return { skipped: true, orderId: existing.id };
        }
      }

      this.logger.error(
        `FAILED processing Shopify order ${webhookData.name} (${shopifyOrderId}) for shop ${shopDomain}: ${error.message}`,
        error.stack,
      );
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

    // Self-healing warehouse — guarantees locationId is never null.
    const warehouseId =
      await this.getOrCreateFallbackWarehouseId(organizationId);

    const orderNumber =
      await this.orderService.generateOrderNumber(organizationId);
    const invoiceNumber =
      await this.orderService.generateInvoiceNumber(organizationId);

    const result = await this.orderRepository.save({
      locationId: warehouseId,
      customerId: customer.customer_Id || undefined,
      // receiverPhoneNumber:
      //   webhookData.shipping_address?.phone ||
      //   webhookData.billing_address?.phone ||
      //   '',
      receiverPhoneNumber: this.normalizeBangladeshPhone(
        webhookData.shipping_address?.phone ||
          webhookData.billing_address?.phone ||
          customer.customerPhoneNumber ||
          '',
      ),
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
  private async getOrCreateFallbackWarehouseId(
    organizationId: string,
  ): Promise<string> {
    let warehouse = await this.warehouseRepository.findOne({
      where: { organizationId, isDefault: true },
    });
    if (warehouse) return warehouse.id;

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

    this.logger.warn(
      `No warehouse at all for org ${organizationId}. Auto-creating fallback "Unassigned" warehouse.`,
    );
    try {
      // NOTE: Warehouse.name has a GLOBAL unique constraint (not scoped to
      // organizationId), so the fallback name must be unique per org too —
      // otherwise the 2nd+ organization to hit this path fails permanently.
      const created = await this.warehouseRepository.save({
        organizationId,
        name: `Unassigned (auto-created) - ${organizationId}`,
        isDefault: true,
      } as any);
      return created.id;
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        // Concurrent request for the SAME org may have created it first.
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
    // const phone =
    //   webhookData.shipping_address?.phone ||
    //   webhookData.billing_address?.phone ||
    //   shopifyCustomer?.phone ||
    //   null;
    const rawPhone =
      webhookData.shipping_address?.phone ||
      webhookData.billing_address?.phone ||
      shopifyCustomer?.phone ||
      null;

    const phone = this.normalizeBangladeshPhone(rawPhone);
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

    const baseCustomerData = {
      customerName: name,
      customerPhoneNumber: phone || '',
      division: webhookData.shipping_address?.province || '',
      district: webhookData.shipping_address?.city || '',
      thana: '',
      country: webhookData.shipping_address?.country || 'Bangladesh',
      customerType: CustomerType.NonProbashi,
      organizationId,
      shopifyCustomerId,
    };

    // customer_Id is a GLOBALLY unique column. Under real production load
    // (Shopify redelivering the same failed webhook, multiple pm2 workers,
    // a burst of mobile orders) many requests can try to create a NEW
    // customer at almost the same instant. An optimistic "read last id,
    // insert, retry on collision" approach was tried first but still failed
    // repeatedly under enough concurrency — retries just re-collide with
    // each other. So this now uses a Postgres transaction-level advisory
    // lock: only ONE request at a time can compute+insert the next
    // customer_Id; every other concurrent request simply waits its turn
    // instead of racing and failing. No retry loop needed — it cannot
    // collide by construction.
    customer = await this.createCustomerWithLock(baseCustomerData);

    this.logger.log(
      `New customer auto-created from Shopify order: ${customer.customer_Id}`,
    );
    return customer;
  }

  private async createCustomerWithLock(
    baseCustomerData: Partial<Customers>,
  ): Promise<Customers> {
    const queryRunner =
      this.customerRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Serializes ALL concurrent customer-creation transactions on this
      // one named lock. Held until commit/rollback, then automatically
      // released — no cleanup needed, no chance of a stuck lock.
      await queryRunner.query(
        `SELECT pg_advisory_xact_lock(hashtext('customer_id_generation'))`,
      );

      const result = await queryRunner.query(
        `SELECT MAX(CAST(SUBSTRING("customer_Id" FROM 5) AS INTEGER)) AS "maxNumber"
         FROM customers
         WHERE "customer_Id" ~ '^CUS-[0-9]+$'`,
      );
      const maxNumber = result?.[0]?.maxNumber;
      const nextNumber =
        maxNumber !== null && maxNumber !== undefined
          ? Number(maxNumber) + 1
          : 10000;

      const saved = await queryRunner.manager.save(Customers, {
        ...baseCustomerData,
        customer_Id: `CUS-${nextNumber}`,
      });
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
      if (isUniqueViolation(err)) {
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

    let shopifyProduct: any;
    try {
      shopifyProduct = JSON.parse(body);
    } catch (err: any) {
      this.logger.error(
        `Invalid JSON body received for product webhook, shop ${shopDomain}: ${err.message}`,
      );
      throw new BadRequestException('Invalid webhook payload');
    }

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

      try {
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
      } catch (err: any) {
        if (isUniqueViolation(err)) {
          // Order webhook / concurrent product webhook may have created
          // this variant already — fetch it instead of failing the whole batch.
          const concurrent = shopifyVariantId
            ? await this.productCatalogRepository.findOne({
                where: { shopifyVariantId, organizationId },
              })
            : await this.productCatalogRepository.findOne({
                where: { shopifyProductId, organizationId },
              });
          if (concurrent) {
            lastSaved = await this.productCatalogRepository.save({
              ...concurrent,
              ...productData,
            });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }

      // ---- Per-variant image matching (FIXED) ----
      // Shopify's canonical way of telling us "which variants use this
      // image" is the image's own `variant_ids` array — NOT just the
      // variant's single `image_id` (that's only the *primary* image).
      // We use variant_ids as the source of truth when it's present, with
      // string-coerced comparisons everywhere so number/string mismatches
      // in the webhook payload never silently break the match.
      const imagesToSync = this.resolveVariantImages(
        shopifyProduct.images || [],
        variant,
      );

      await this.syncProductImages(lastSaved.id, imagesToSync);
    }

    return lastSaved;
  }

  // ---------- HELPER: এই নির্দিষ্ট variant-এর জন্য কোন images প্রযোজ্য তা বের করা ----------
  // Rules (in priority order):
  // 1. If ANY image in the product has a non-empty `variant_ids` array,
  //    that means Shopify has explicitly split images per variant — trust
  //    it fully. This variant gets ONLY the images whose variant_ids
  //    include this variant's id (could legitimately be zero images).
  // 2. Otherwise (no image has variant_ids info at all — e.g. some legacy
  //    payloads, or a genuinely single-image/non-split product), fall back
  //    to matching by the variant's primary `image_id`.
  // 3. If that also fails to match anything AND there's truly no
  //    variant-level image data anywhere on the product, only THEN give
  //    every variant the full image list (this is the correct behavior
  //    for a real single-image product, e.g. only 1 photo total).
  private resolveVariantImages(shopifyImages: any[], variant: any): any[] {
    if (!shopifyImages.length) return [];

    const hasAnyVariantMapping = shopifyImages.some(
      (img: any) =>
        Array.isArray(img.variant_ids) && img.variant_ids.length > 0,
    );

    if (hasAnyVariantMapping) {
      const mapped = shopifyImages.filter(
        (img: any) =>
          Array.isArray(img.variant_ids) &&
          img.variant_ids.some(
            (vid: any) => String(vid) === String(variant.id),
          ),
      );
      // Trust Shopify's mapping even if it's empty for this variant —
      // do NOT fall back to all images here, that's exactly the bug
      // that caused every variant to get every other variant's photos.
      return mapped;
    }

    // No variant-level mapping exists anywhere on this product.
    if (variant.image_id) {
      const byPrimaryImage = shopifyImages.filter(
        (img: any) => String(img.id) === String(variant.image_id),
      );
      if (byPrimaryImage.length) return byPrimaryImage;
    }

    // Truly a single-image / non-split product — every variant shares it.
    return shopifyImages;
  }

  // ---------- Replace-style image sync (SAFE: only touches product_images table) ----------
  // Deletes this product's existing images and re-inserts the current
  // Shopify image list, so images that were removed/reassigned on Shopify
  // (or wrongly synced earlier due to the old bug) don't linger forever.
  //
  // IMPORTANT SAFETY NOTES:
  // - This ONLY operates on the `productImagesRepository` (product_images
  //   table). It never reads, writes, or deletes anything on the `Product`
  //   row itself (name, sku, price, id, etc. are untouched).
  // - `Product.id` never changes here, and Orders reference products via
  //   `productId` (a link to `Product.id`), NOT via any image id. So
  //   existing orders, invoices, and sales history are completely
  //   unaffected by deleting/re-adding rows in product_images.
  // - Wrapped in a DB transaction: if the insert step fails for any
  //   reason, the delete is rolled back too — so a partial failure can
  //   NEVER leave the product with zero images. Worst case, this run's
  //   changes just don't apply and the old images silently remain
  //   (logged as an error), ready to retry on the next webhook delivery.
  private async syncProductImages(productId: string, shopifyImages: any[]) {
    const queryRunner =
      this.productImagesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Wipe this product's current image rows...
      await queryRunner.manager.delete(ProductImages, { productId });

      // ...and re-insert exactly what Shopify says is current.
      // (If shopifyImages is empty, product ends up with zero images —
      // which correctly reflects Shopify reality, e.g. all photos removed.)
      const validImages = (shopifyImages || []).filter((img: any) => !!img.src);
      if (validImages.length) {
        const rows = validImages.map((img: any) => ({
          url: img.src,
          delete_url: img.src,
          productId,
        }));
        await queryRunner.manager.save(ProductImages, rows);
      }

      await queryRunner.commitTransaction();
      this.logger.debug(
        `Images resynced for product ${productId}: ${validImages.length} image(s)`,
      );
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Image sync failed for product ${productId}, old images kept intact: ${err.message}`,
        err.stack,
      );
    } finally {
      await queryRunner.release();
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
