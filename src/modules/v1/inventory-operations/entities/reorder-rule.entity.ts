import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Product } from '../../product/entity/product.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';

@Entity({ name: 'product_reorder_rules' })
@Index(['organizationId', 'productId', 'warehouseId'], { unique: true })
export class ProductReorderRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'uuid', nullable: true })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'int', default: 10 })
  minStockLevel: number; // Low stock alert threshold

  @Column({ type: 'int', default: 100 })
  maxStockLevel: number; // Reorder ceiling

  @Column({ type: 'int', default: 50 })
  reorderQuantity: number; // Suggested PO quantity

  @Column({ type: 'boolean', default: true })
  isAlertActive: boolean;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
