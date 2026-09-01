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
import { Customers } from '../../customers/entities/customers.entity';

export enum CustomerLedgerType {
  INVOICE = 'Invoice',
  PAYMENT = 'Payment',
  RETURN_CREDIT = 'ReturnCredit',
  REFUND = 'Refund',
  OPENING_BALANCE = 'OpeningBalance',
  ADJUSTMENT = 'Adjustment',
}

@Entity({ name: 'customer_ledger_entries' })
@Index(['organizationId', 'customerId'])
@Index(['organizationId', 'entryDate'])
export class CustomerLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', nullable: false })
  entryDate: string;

  @Column({ type: 'int', nullable: false })
  customerId: number;

  @ManyToOne(() => Customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customers;

  @Column({
    type: 'enum',
    enum: CustomerLedgerType,
    default: CustomerLedgerType.INVOICE,
  })
  entryType: CustomerLedgerType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceType: string; // 'Order', 'PaymentReceipt', 'Return'

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  debit: number; // Invoiced amount (increases customer receivable)

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  credit: number; // Payment received (decreases customer receivable)

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  runningBalance: number;

  @Column({ type: 'text', nullable: true })
  narration: string;

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
