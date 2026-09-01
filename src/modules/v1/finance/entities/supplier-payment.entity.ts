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
import { SupplierBill } from './supplier-bill.entity';
import { BankAccount } from './bank-account.entity';

@Entity({ name: 'supplier_payments' })
@Index(['organizationId', 'paymentNumber'], { unique: true })
@Index(['organizationId', 'supplierId'])
export class SupplierPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  paymentNumber: string;

  @Column({ type: 'date', nullable: false })
  paymentDate: string;

  @Column({ type: 'uuid', nullable: false })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({ type: 'uuid', nullable: true })
  supplierBillId: string;

  @ManyToOne(() => SupplierBill, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplierBillId' })
  supplierBill: SupplierBill;

  @Column({ type: 'uuid', nullable: false })
  bankAccountId: string;

  @ManyToOne(() => BankAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bankAccountId' })
  bankAccount: BankAccount;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  amount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber: string; // Cheque #, Txn ID, etc.

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
