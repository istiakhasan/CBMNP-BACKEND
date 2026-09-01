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
import { GoodsReceiptNote } from './goods-receipt-note.entity';
import { Product } from '../../product/entity/product.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'goods_receipt_items' })
export class GoodsReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  grnId: string;

  @ManyToOne(() => GoodsReceiptNote, (g) => g.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grnId' })
  grn: GoodsReceiptNote;

  @Column({ type: 'uuid', nullable: false })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', nullable: false })
  orderedQuantity: number;

  @Column({ type: 'int', nullable: false })
  deliveredQuantity: number;

  @Column({ type: 'int', nullable: false })
  acceptedQuantity: number; // Passed QA inspection -> added to stock

  @Column({ type: 'int', default: 0 })
  rejectedQuantity: number; // Damaged / failed QA -> rejected

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchNumber: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rejectionReason: string;

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
