import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Products } from '../../order/entities/products.entity';
import { Category } from '../../category/entity/category.entity';
import { Attribute } from './attributes.entity';
import { ProductImages } from './image.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { InventoryItem } from '../../inventory/entities/inventoryitem.entity';
import { ProcurementItem } from '../../procurement/entities/procurementItem.entity';
enum ProductType {
  Variant = 'Variant',
  SimpleProduct = 'Simple product',
  BaseProduct = 'Base Product',
}
@Entity({ name: 'product' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => ProductImages, (images) => images.product, { cascade: true, eager: true })
  images: ProductImages[];

  @OneToMany(() => Attribute, (attribute) => attribute.product, { cascade: true })
  attributes: Attribute[];

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true, type: 'text' })
  sku: string;

  @Column({ nullable: false, type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'boolean' })
  active: boolean;

  @Column({ nullable: false, type: 'text' })
  weight: string;

  @Column({ nullable: false, type: 'text' })
  unit: string;
  @Column({ nullable: true })
  organizationId: string;

  @Column({ nullable: true, type: 'enum', enum: ProductType, enumName: 'product_type_enum' })
  productType: 'Variant' | 'Simple product' | 'Base Product';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  regularPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  retailPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  distributionPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  purchasePrice: number;

  @OneToMany(() => Products, (products) => products.product)
  products: Products[];

  @Column({ type: 'string', nullable: true })
  categoryId: string;

  @Column({ nullable: true })
  isBaseProduct: boolean;

  @ManyToOne(() => Product, (product) => product.variants, { nullable: true })
  @JoinColumn({ name: 'baseProductId' })
  baseProduct: Product;

  @Column({ nullable: true })
  baseProductId: string;

  @OneToMany(() => Product, (product) => product.baseProduct)
  variants: Product[];

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'categoryId', referencedColumnName: 'id' })
  category: Category;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;

  @OneToOne(() => Inventory, (inventory) => inventory.product)
  inventories: Inventory;

  @OneToMany(() => Transaction, (transaction) => transaction.product)
  @JoinColumn({name:"productId",referencedColumnName:"productId"})
  transactions: Transaction[];
  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.product, {
    cascade: true,
  })
  inventoryItems: InventoryItem[];

  @OneToMany(() => ProcurementItem, (procurementItem) => procurementItem.product)
  procurementItems: ProcurementItem[];
}

