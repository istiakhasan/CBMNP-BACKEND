import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// ─── 1. General E-Commerce Store & Theme Settings ──────────────────────────────
@Entity({ name: 'ecommerce_settings' })
export class EcommerceSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ default: 'My Modest Store' })
  storeName: string;

  @Column({ type: 'text', nullable: true })
  storeTagline: string;

  @Column({ type: 'text', nullable: true })
  logoUrl: string;

  @Column({ type: 'text', nullable: true })
  faviconUrl: string;

  // Announcement Bar
  @Column({ default: true })
  announcementEnabled: boolean;

  @Column({ type: 'text', default: '✨ Free Nationwide Delivery on Orders Over ৳2,500 | Use Code: EID2026' })
  announcementText: string;

  @Column({ default: '#1e293b' })
  announcementBg: string;

  @Column({ default: '#ffffff' })
  announcementTextColor: string;

  @Column({ type: 'text', nullable: true })
  announcementLink: string;

  // Brand Colors
  @Column({ default: '#1e293b' })
  primaryColor: string;

  @Column({ default: '#beaa8d' })
  accentColor: string;

  @Column({ default: '#f7efe3' })
  bgLightColor: string;

  @Column({ default: '#1a1a1a' })
  textColor: string;

  // Typography
  @Column({ default: 'Playfair Display' })
  headingFont: string;

  @Column({ default: 'Inter' })
  bodyFont: string;

  // Header & Footer Layouts
  @Column({ default: 'sticky-luxury' })
  headerStyle: string; // 'sticky-luxury' | 'minimal' | 'centered-logo'

  @Column({ default: 'four-column' })
  footerStyle: string;

  @Column({ type: 'text', nullable: true })
  footerAboutText: string;

  @Column({ type: 'text', nullable: true })
  copyrightText: string;

  // Contact & Socials
  @Column({ nullable: true })
  supportEmail: string;

  @Column({ nullable: true })
  supportPhone: string;

  @Column({ nullable: true })
  whatsappNumber: string;

  @Column({ nullable: true })
  facebookUrl: string;

  @Column({ nullable: true })
  instagramUrl: string;

  @Column({ nullable: true })
  youtubeUrl: string;

  // Currency & Ordering
  @Column({ default: '৳' })
  currencySymbol: string;

  @Column({ default: 'BDT' })
  currencyCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 2500 })
  freeShippingThreshold: number;

  @Column({ default: true })
  enableCod: boolean;

  @Column({ default: true })
  enableBkash: boolean;

  @Column({ type: 'text', nullable: true })
  bkashMerchantNumber: string;

  @Column({ default: true })
  enableNagad: boolean;

  @Column({ type: 'text', nullable: true })
  nagadMerchantNumber: string;

  @Column({ type: 'text', nullable: true })
  customCss: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── 2. Hero Slideshow & Promotional Banners ──────────────────────────────────
@Entity({ name: 'ecommerce_banners' })
export class EcommerceBanner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ default: 'hero' })
  bannerType: string; // 'hero' | 'promo-middle' | 'popup' | 'side-banner'

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string;

  @Column({ type: 'text', nullable: true })
  badgeText: string; // e.g. "Exclusive Eid Collection"

  @Column({ type: 'text' })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  mobileImageUrl: string;

  @Column({ default: 'Shop Now' })
  buttonText: string;

  @Column({ type: 'text', default: '/collections/all' })
  buttonLink: string;

  @Column({ type: 'text', nullable: true })
  secondaryButtonText: string;

  @Column({ type: 'text', nullable: true })
  secondaryButtonLink: string;

  @Column({ default: 'left' })
  textAlignment: string; // 'left' | 'center' | 'right'

  @Column({ default: 0.25, type: 'float' })
  overlayOpacity: number;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── 3. Dynamic Homepage Sections Builder ─────────────────────────────────────
@Entity({ name: 'ecommerce_sections' })
export class EcommerceSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column()
  sectionType: string; // 'hero_slider' | 'featured_categories' | 'curated_collection' | 'flash_sale' | 'lookbook_banner' | 'trust_badges' | 'customer_reviews' | 'rich_text'

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>; // Flexible json config (e.g. collectionId, categoryIds, displayLimit, background)

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── 4. Curated Collections ───────────────────────────────────────────────────
@Entity({ name: 'ecommerce_collections' })
export class EcommerceCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column()
  name: string;

  @Column({ unique: false })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  bannerImageUrl: string;

  @Column({ type: 'simple-array', nullable: true })
  productIds: string[]; // references existing Product UUIDs without altering Product schema

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ nullable: true })
  badgeText: string; // "Hot", "Trending", "New"

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── 5. Discount Coupons & Vouchers ───────────────────────────────────────────
@Entity({ name: 'ecommerce_coupons' })
export class EcommerceCoupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ unique: false })
  code: string;

  @Column({ default: 'percentage' })
  discountType: string; // 'percentage' | 'fixed' | 'free_shipping'

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minOrderAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxDiscountAmount: number;

  @Column({ type: 'int', nullable: true })
  usageLimit: number;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiryDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── 6. Shipping & Delivery Rules ─────────────────────────────────────────────
@Entity({ name: 'ecommerce_shipping_rules' })
export class EcommerceShippingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column()
  name: string; // "Inside Dhaka (Standard)", "Outside Dhaka (Express)", "Sub-Dhaka"

  @Column({ default: 'all' })
  zoneType: string; // 'inside_dhaka' | 'outside_dhaka' | 'nationwide' | 'specific_districts'

  @Column({ type: 'simple-array', nullable: true })
  districts: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 80 })
  cost: number;

  @Column({ type: 'text', nullable: true })
  estimatedDeliveryTime: string; // "24 - 48 Hours"

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  freeShippingAbove: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── 7. Customer Reviews & Ratings Moderation ─────────────────────────────────
@Entity({ name: 'ecommerce_reviews' })
export class EcommerceReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ nullable: true })
  productId: string;

  @Column()
  productName: string;

  @Column()
  customerName: string;

  @Column({ nullable: true })
  customerEmail: string;

  @Column({ default: 5 })
  rating: number; // 1 - 5

  @Column({ type: 'text', nullable: true })
  reviewTitle: string;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'simple-array', nullable: true })
  photos: string[];

  @Column({ default: true })
  isVerifiedPurchase: boolean;

  @Column({ default: 'approved' })
  status: string; // 'pending' | 'approved' | 'rejected'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── 8. CMS Pages & Custom Policies ───────────────────────────────────────────
@Entity({ name: 'ecommerce_pages' })
export class EcommercePage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column()
  title: string; // "About Tabaya", "Fabric & Size Guide", "Return & Refund Policy"

  @Column({ unique: false })
  slug: string;

  @Column({ type: 'text' })
  content: string; // Rich HTML or markdown

  @Column({ default: 'footer' })
  placement: string; // 'header' | 'footer' | 'policy' | 'hidden'

  @Column({ default: true })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
