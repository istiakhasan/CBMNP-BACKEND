import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { StockAdjustmentItem } from './stock-adjustment-item.entity';

export enum AdjustmentStatus {
  DRAFT = 'Draft',
  PENDING_APPROVAL = 'PendingApproval',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum AdjustmentReason {
  PHYSICAL_COUNT_MISMATCH = 'CountMismatch',
  DAMAGED_GOODS = 'Damage',
  EXPIRED_STOCK = 'Expired',
  THEFT_OR_LOSS = 'TheftOrLoss',
  FOUND_STOCK = 'FoundStock',
  OTHER = 'Other',
}

@Entity({ name: 'stock_adjustments' })
@Index(['organizationId', 'adjustmentNumber'], { unique: true })
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  adjustmentNumber: string; // e.g. "ADJ-2025-000001"

  @Column({ type: 'date', nullable: false })
  adjustmentDate: string;

  @Column({ type: 'uuid', nullable: false })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({
    type: 'enum',
    enum: AdjustmentReason,
    default: AdjustmentReason.PHYSICAL_COUNT_MISMATCH,
  })
  reason: AdjustmentReason;

  @Column({
    type: 'enum',
    enum: AdjustmentStatus,
    default: AdjustmentStatus.DRAFT,
  })
  status: AdjustmentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedById: string;

  @OneToMany(() => StockAdjustmentItem, (item) => item.stockAdjustment, { cascade: true })
  items: StockAdjustmentItem[];

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
