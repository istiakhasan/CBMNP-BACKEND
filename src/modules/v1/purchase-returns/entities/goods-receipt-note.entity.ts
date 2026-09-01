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
import { GoodsReceiptItem } from './goods-receipt-item.entity';

export enum GRNStatus {
  DRAFT = 'Draft',
  INSPECTED = 'Inspected',
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
}

@Entity({ name: 'goods_receipt_notes' })
@Index(['organizationId', 'grnNumber'], { unique: true })
export class GoodsReceiptNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  grnNumber: string; // e.g. "GRN-2025-000001"

  @Column({ type: 'date', nullable: false })
  receivedDate: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  procurementId: string; // Linked PO

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
  supplierDeliveryChallan: string;

  @Column({
    type: 'enum',
    enum: GRNStatus,
    default: GRNStatus.ACCEPTED,
  })
  status: GRNStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  inspectedById: string;

  @Column({ type: 'text', nullable: true })
  inspectionNotes: string;

  @OneToMany(() => GoodsReceiptItem, (item) => item.grn, { cascade: true })
  items: GoodsReceiptItem[];

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
