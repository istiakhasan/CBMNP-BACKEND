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
import { StockAdjustment } from './stock-adjustment.entity';
import { Product } from '../../product/entity/product.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'stock_adjustment_items' })
export class StockAdjustmentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  stockAdjustmentId: string;

  @ManyToOne(() => StockAdjustment, (sa) => sa.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stockAdjustmentId' })
  stockAdjustment: StockAdjustment;

  @Column({ type: 'uuid', nullable: false })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', nullable: false })
  systemQuantity: number; // Snapshot of current recorded stock

  @Column({ type: 'int', nullable: false })
  countedQuantity: number; // Physical count

  @Column({ type: 'int', nullable: false })
  varianceQuantity: number; // countedQuantity - systemQuantity

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  unitCost: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalVarianceValue: number; // varianceQuantity * unitCost

  @Column({ type: 'varchar', length: 255, nullable: true })
  itemNote: string;

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
