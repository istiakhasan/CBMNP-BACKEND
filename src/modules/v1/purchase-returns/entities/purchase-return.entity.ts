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
import { Supplier } from '../../supplier/entities/supplier.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { PurchaseReturnItem } from './purchase-return-item.entity';

export enum PurchaseReturnStatus {
  DRAFT = 'Draft',
  APPROVED = 'Approved',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

@Entity({ name: 'purchase_returns' })
@Index(['organizationId', 'returnNumber'], { unique: true })
export class PurchaseReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  returnNumber: string; // e.g. "PR-2025-000001"

  @Column({ type: 'varchar', length: 100, nullable: true })
  debitNoteNumber: string; // e.g. "DN-2025-000001"

  @Column({ type: 'date', nullable: false })
  returnDate: string;

  @Column({ type: 'uuid', nullable: false })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({ type: 'uuid', nullable: false })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'varchar', length: 100, nullable: true })
  procurementId: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: PurchaseReturnStatus,
    default: PurchaseReturnStatus.DRAFT,
  })
  status: PurchaseReturnStatus;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn, { cascade: true })
  items: PurchaseReturnItem[];

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
