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
import { Supplier } from '../../supplier/entities/supplier.entity';

export enum SupplierBillStatus {
  UNPAID = 'Unpaid',
  PARTIALLY_PAID = 'PartiallyPaid',
  PAID = 'Paid',
  CANCELLED = 'Cancelled',
}

@Entity({ name: 'supplier_bills' })
@Index(['organizationId', 'billNumber'], { unique: true })
@Index(['organizationId', 'supplierId'])
export class SupplierBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  billNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierInvoiceNumber: string;

  @Column({ type: 'date', nullable: false })
  billDate: string;

  @Column({ type: 'date', nullable: true })
  dueDate: string;

  @Column({ type: 'uuid', nullable: false })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({ type: 'varchar', length: 100, nullable: true })
  procurementId: string; // Linked PO / Procurement

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  totalAmount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  paidAmount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  dueAmount: number;

  @Column({
    type: 'enum',
    enum: SupplierBillStatus,
    default: SupplierBillStatus.UNPAID,
  })
  status: SupplierBillStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

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
