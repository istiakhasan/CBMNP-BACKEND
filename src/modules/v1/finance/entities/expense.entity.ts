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
import { ExpenseCategory } from './expense-category.entity';
import { BankAccount } from './bank-account.entity';

export enum ExpenseStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted',
  APPROVED = 'Approved',
  PAID = 'Paid',
  REJECTED = 'Rejected',
}

@Entity({ name: 'expenses' })
@Index(['organizationId', 'expenseNumber'], { unique: true })
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  expenseNumber: string;

  @Column({ type: 'date', nullable: false })
  expenseDate: string;

  @Column({ type: 'uuid', nullable: false })
  expenseCategoryId: string;

  @ManyToOne(() => ExpenseCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'expenseCategoryId' })
  expenseCategory: ExpenseCategory;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  amount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  taxAmount: number;

  @Column({ type: 'uuid', nullable: true })
  bankAccountId: string;

  @ManyToOne(() => BankAccount, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bankAccountId' })
  bankAccount: BankAccount;

  @Column({ type: 'varchar', length: 150, nullable: true })
  paidTo: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber: string;

  @Column({ type: 'text', nullable: true })
  receiptUrl: string;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column({
    type: 'enum',
    enum: ExpenseStatus,
    default: ExpenseStatus.PAID,
  })
  status: ExpenseStatus;

  @Column({ type: 'uuid', nullable: true })
  branchId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedById: string;

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
