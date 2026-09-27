import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EcommerceBanner,
  EcommerceCollection,
  EcommerceCoupon,
  EcommercePage,
  EcommerceReview,
  EcommerceSection,
  EcommerceSetting,
  EcommerceShippingRule,
} from './entities/ecommerce.entity';

import { Product } from '../product/entity/product.entity';
import { Order } from '../order/entities/order.entity';
import { Products } from '../order/entities/products.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

@Injectable()
export class EcommerceService {
  private readonly resources: Record<string, Repository<any>>;

  constructor(
    @InjectRepository(EcommerceSetting)
    private readonly settingsRepo: Repository<EcommerceSetting>,
    @InjectRepository(EcommerceBanner)
    private readonly bannersRepo: Repository<EcommerceBanner>,
    @InjectRepository(EcommerceSection)
    private readonly sectionsRepo: Repository<EcommerceSection>,
    @InjectRepository(EcommerceCollection)
    private readonly collectionsRepo: Repository<EcommerceCollection>,
    @InjectRepository(EcommerceCoupon)
    private readonly couponsRepo: Repository<EcommerceCoupon>,
    @InjectRepository(EcommerceShippingRule)
    private readonly shippingRepo: Repository<EcommerceShippingRule>,
    @InjectRepository(EcommerceReview)
    private readonly reviewsRepo: Repository<EcommerceReview>,
    @InjectRepository(EcommercePage)
    private readonly pagesRepo: Repository<EcommercePage>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Products)
    private readonly orderProductRepo: Repository<Products>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) {
    this.resources = {
      settings: this.settingsRepo,
      banners: this.bannersRepo,
      sections: this.sectionsRepo,
      collections: this.collectionsRepo,
      coupons: this.couponsRepo,
      shipping: this.shippingRepo,
      reviews: this.reviewsRepo,
      pages: this.pagesRepo,
    };
  }

  private getRepository(resource: string): Repository<any> {
    const repo = this.resources[resource];
    if (!repo) {
      throw new BadRequestException(`Unknown e-commerce resource '${resource}'`);
    }
    return repo;
  }

  // ─── SETTINGS & STORE PROFILE ───────────────────────────────────────────────
  async getSettings(organizationId: string): Promise<EcommerceSetting> {
    let setting = await this.settingsRepo.findOne({
      where: [{ organizationId }, { organizationId: null as any }],
      order: { createdAt: 'DESC' },
    });

    if (!setting) {
      setting = this.settingsRepo.create({
        organizationId,
        storeName: 'Tabaya Modest Wear',
        storeTagline: 'Luxury Abayas, Hijabs & Contemporary Modest Fashion',
        announcementEnabled: true,
        announcementText: '✨ Free Nationwide Delivery on Orders Over ৳2,500 | Use Code: EID2026',
        announcementBg: '#1e293b',
        announcementTextColor: '#ffffff',
        primaryColor: '#1e293b',
        accentColor: '#beaa8d',
        bgLightColor: '#f7efe3',
        textColor: '#1a1a1a',
        headingFont: 'Playfair Display',
        bodyFont: 'Inter',
        headerStyle: 'sticky-luxury',
        footerStyle: 'four-column',
        currencySymbol: '৳',
        currencyCode: 'BDT',
        freeShippingThreshold: 2500,
        enableCod: true,
        enableBkash: true,
        enableNagad: true,
      });
      await this.settingsRepo.save(setting);
    }
    return setting;
  }

  async updateSettings(organizationId: string, data: Partial<EcommerceSetting>): Promise<EcommerceSetting> {
    let setting = await this.getSettings(organizationId);
    Object.assign(setting, data, { organizationId });
    return await this.settingsRepo.save(setting);
  }

  // ─── GENERIC RESOURCE CRUD ──────────────────────────────────────────────────
  async findAll(resource: string, organizationId: string, query: any = {}): Promise<any> {
    const repo = this.getRepository(resource);
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true' || query.isActive === true;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.bannerType) {
      where.bannerType = query.bannerType;
    }

    const order: any = {};
    if (resource === 'banners' || resource === 'sections' || resource === 'collections') {
      order.sortOrder = 'ASC';
    } else {
      order.createdAt = 'DESC';
    }

    return await repo.find({ where, order });
  }

  async findOne(resource: string, id: string, organizationId: string): Promise<any> {
    const repo = this.getRepository(resource);
    const item = await repo.findOne({ where: { id, organizationId } });
    if (!item) {
      throw new NotFoundException(`Item not found in ${resource}`);
    }
    return item;
  }

  async create(resource: string, organizationId: string, data: any): Promise<any> {
    const repo = this.getRepository(resource);
    const newItem = repo.create({ ...data, organizationId });
    return await repo.save(newItem);
  }

  async update(resource: string, id: string, organizationId: string, data: any): Promise<any> {
    const repo = this.getRepository(resource);
    const item = await this.findOne(resource, id, organizationId);
    Object.assign(item, data);
    return await repo.save(item);
  }

  async remove(resource: string, id: string, organizationId: string): Promise<{ success: boolean }> {
    const repo = this.getRepository(resource);
    const item = await this.findOne(resource, id, organizationId);
    await repo.remove(item);
    return { success: true };
  }

  // ─── DASHBOARD & STOREFRONT OVERVIEW ────────────────────────────────────────
  async getDashboardStats(organizationId: string): Promise<any> {
    const [banners, collections, coupons, reviews, pages, shippingRules] = await Promise.all([
      this.bannersRepo.count({ where: { organizationId, isActive: true } }),
      this.collectionsRepo.count({ where: { organizationId, isActive: true } }),
      this.couponsRepo.count({ where: { organizationId, isActive: true } }),
      this.reviewsRepo.count({ where: { organizationId, status: 'approved' } }),
      this.pagesRepo.count({ where: { organizationId, isPublished: true } }),
      this.shippingRepo.count({ where: { organizationId, isActive: true } }),
    ]);

    const pendingReviews = await this.reviewsRepo.count({
      where: { organizationId, status: 'pending' },
    });

    const settings = await this.getSettings(organizationId);

    return {
      storeName: settings.storeName,
      activeBanners: banners,
      curatedCollections: collections,
      activeCoupons: coupons,
      verifiedReviews: reviews,
      pendingReviews,
      publishedPages: pages,
      shippingMethods: shippingRules,
      brandPrimaryColor: settings.primaryColor,
      headingFont: settings.headingFont,
    };
  }

  // ─── PUBLIC STOREFRONT API (CONSUMABLE BY STOREFRONT APP) ───────────────────
  async getStorefrontConfig(organizationId: string): Promise<any> {
    const [settings, banners, sections, collections, shippingRules, pages, reviews] = await Promise.all([
      this.getSettings(organizationId),
      this.bannersRepo.find({ where: { organizationId, isActive: true }, order: { sortOrder: 'ASC' } }),
      this.sectionsRepo.find({ where: { organizationId, isActive: true }, order: { sortOrder: 'ASC' } }),
      this.collectionsRepo.find({ where: { organizationId, isActive: true }, order: { sortOrder: 'ASC' } }),
      this.shippingRepo.find({ where: { organizationId, isActive: true } }),
      this.pagesRepo.find({ where: { organizationId, isPublished: true } }),
      this.reviewsRepo.find({ where: { organizationId, status: 'approved' }, order: { createdAt: 'DESC' }, take: 10 }),
    ]);

    return {
      settings,
      banners,
      sections,
      collections,
      shippingRules,
      pages,
      featuredReviews: reviews,
    };
  }

  // ─── VALIDATE COUPON ────────────────────────────────────────────────────────
  async validateCoupon(organizationId: string, code: string, orderTotal: number): Promise<any> {
    const coupon = await this.couponsRepo.findOne({
      where: { code: code.toUpperCase().trim(), organizationId, isActive: true },
    });

    if (!coupon) {
      throw new BadRequestException('Invalid or expired coupon code');
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      throw new BadRequestException('This coupon is not active yet');
    }
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      throw new BadRequestException('This coupon has expired');
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (orderTotal < Number(coupon.minOrderAmount || 0)) {
      throw new BadRequestException(`Minimum spend of ৳${coupon.minOrderAmount} required for this coupon`);
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (orderTotal * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscountAmount && discountAmount > Number(coupon.maxDiscountAmount)) {
        discountAmount = Number(coupon.maxDiscountAmount);
      }
    } else if (coupon.discountType === 'fixed') {
      discountAmount = Number(coupon.discountValue);
    } else if (coupon.discountType === 'free_shipping') {
      discountAmount = 0; // handled as free shipping flag
    }

    return {
      isValid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: Math.min(discountAmount, orderTotal),
      finalTotal: Math.max(0, orderTotal - discountAmount),
    };
  }

  // ─── STOREFRONT PRODUCTS CATALOG WITH INVENTORY ───────────────────────────────
  async getStorefrontProducts(organizationId?: string): Promise<any[]> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.attributes', 'attributes');

    if (organizationId) {
      qb.where('product.organizationId = :organizationId', { organizationId });
    }

    const products = await qb.orderBy('product.createdAt', 'DESC').take(100).getMany();

    // Map inventory / stock details
    const productIds = products.map((p) => p.id);
    let inventoryMap: Record<string, number> = {};

    if (productIds.length > 0) {
      try {
        const inventories = await this.inventoryRepo
          .createQueryBuilder('inv')
          .where('inv.productId IN (:...productIds)', { productIds })
          .getMany();

        for (const inv of inventories) {
          inventoryMap[inv.productId] = Number(inv.stock || 0);
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

    return products.map((p) => {
      const stock = inventoryMap[p.id] !== undefined ? inventoryMap[p.id] : 50;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        regularPrice: Number(p.regularPrice) || 0,
        salePrice: Number(p.salePrice) || Number(p.regularPrice) || 0,
        retailPrice: Number(p.retailPrice) || Number(p.regularPrice) || 0,
        images: (p.images || []).map((img) => img.url),
        category: p.category ? { id: p.category.id, name: p.category.label } : null,
        attributes: p.attributes || [],
        inStock: stock > 0,
        stockQuantity: stock,
      };
    });
  }

  // ─── STOREFRONT CHECKOUT / ORDER PLACEMENT ────────────────────────────────────
  async createStorefrontOrder(orderData: any, organizationId?: string): Promise<any> {
    const {
      customerName,
      customerPhone,
      customerAddress,
      customerDistrict,
      deliveryArea,
      items,
      paymentMethod = 'cod',
      couponCode,
      notes,
    } = orderData;

    if (!customerName || !customerPhone || !customerAddress || !items || items.length === 0) {
      throw new BadRequestException('Customer details and cart items are required');
    }

    // Calculate Subtotal & Validate Items
    let subtotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const itemPrice = Number(item.price) || 0;
      const itemQty = Math.max(1, Number(item.quantity) || 1);
      const lineTotal = itemPrice * itemQty;
      subtotal += lineTotal;

      validatedItems.push({
        productId: item.productId,
        productQuantity: itemQty,
        productPrice: itemPrice,
        subtotal: lineTotal,
      });
    }

    // Evaluate Coupon Discount
    let discountAmount = 0;
    if (couponCode) {
      try {
        const couponResult = await this.validateCoupon(organizationId || '', couponCode, subtotal);
        discountAmount = couponResult.discountAmount || 0;
        // Increment coupon count
        await this.couponsRepo
          .createQueryBuilder()
          .update(EcommerceCoupon)
          .set({ usedCount: () => 'used_count + 1' })
          .where('code = :code', { code: couponCode.toUpperCase().trim() })
          .execute();
      } catch (e) {
        // ignore or proceed without coupon
      }
    }

    // Calculate Delivery Charge
    const settings = await this.getSettings(organizationId || '');
    let deliveryCharge = deliveryArea === 'outside_dhaka' ? 130 : 80;
    if (settings.freeShippingThreshold && subtotal >= Number(settings.freeShippingThreshold)) {
      deliveryCharge = 0;
    }

    const totalAmount = Math.max(0, subtotal - discountAmount + deliveryCharge);
    const orderNumber = `TABAYA-${Date.now().toString().slice(-6)}`;

    // Create Order Record in ERP database
    const newOrder = new Order();
    newOrder.orderNumber = orderNumber;
    newOrder.invoiceNumber = orderNumber;
    newOrder.receiverName = customerName;
    newOrder.receiverPhoneNumber = customerPhone;
    newOrder.receiverAddress = customerAddress;
    newOrder.receiverDistrict = customerDistrict || deliveryArea || 'Dhaka';
    newOrder.deliveryNote = notes || 'Online Storefront Customer Order';
    newOrder.orderSource = 'Ecommerce Store';
    newOrder.orderType = 'online';
    newOrder.shippingType = deliveryArea || 'inside_dhaka';
    newOrder.paymentMethod = paymentMethod.toUpperCase();
    newOrder.paymentStatus = 'pending';
    newOrder.statusId = 1; // Pending
    newOrder.productValue = subtotal;
    newOrder.totalPrice = totalAmount;
    newOrder.totalReceiveAbleAmount = totalAmount;
    newOrder.discount = discountAmount;
    newOrder.deliveryCharge = deliveryCharge;
    if (organizationId) {
      newOrder.organizationId = organizationId;
    }

    const savedOrder: Order = await this.orderRepo.save(newOrder);

    // Save Product Items
    const orderProducts = validatedItems.map((vItem) => {
      const op = new Products();
      op.orderId = savedOrder.id;
      op.productId = vItem.productId;
      op.productQuantity = vItem.productQuantity;
      op.productPrice = vItem.productPrice;
      op.subtotal = vItem.subtotal;
      return op;
    });
    await this.orderProductRepo.save(orderProducts);

    return {
      success: true,
      orderNumber: savedOrder.orderNumber,
      orderId: savedOrder.id,
      totalAmount: savedOrder.totalPrice,
      subtotal,
      discountAmount,
      deliveryCharge,
      customerName,
      customerPhone,
      message: 'Order placed successfully! We will contact you soon for confirmation.',
    };
  }
}

