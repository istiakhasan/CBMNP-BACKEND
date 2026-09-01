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
import { JournalItem } from './journal-item.entity';

export enum JournalEntryType {
  MANUAL_JOURNAL = 'ManualJournal',
  SALES_INVOICE = 'SalesInvoice',
  PAYMENT_RECEIPT = 'PaymentReceipt',
  PURCHASE_BILL = 'PurchaseBill',
  EXPENSE_VOUCHER = 'ExpenseVoucher',
  FUND_TRANSFER = 'FundTransfer',
  OPENING_BALANCE = 'OpeningBalance',
}

export enum JournalEntryStatus {
  DRAFT = 'Draft',
  POSTED = 'Posted',
  VOID = 'Void',
}

@Entity({ name: 'journal_entries' })
@Index(['organizationId', 'entryNumber'], { unique: true })
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  entryNumber: string;

  @Column({ type: 'date', nullable: false })
  @Index()
  entryDate: string;

  @Column({
    type: 'enum',
    enum: JournalEntryType,
    default: JournalEntryType.MANUAL_JOURNAL,
  })
  entryType: JournalEntryType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string;

  @Column({ type: 'text', nullable: false })
  narration: string;

  @Column({
    type: 'enum',
    enum: JournalEntryStatus,
    default: JournalEntryStatus.POSTED,
  })
  status: JournalEntryStatus;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

  @Column({ type: 'timestamp', nullable: true })
  postedAt: Date;

  @OneToMany(() => JournalItem, (item) => item.journalEntry, {
    cascade: true,
  })
  items: JournalItem[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
