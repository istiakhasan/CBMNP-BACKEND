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

export enum AccountType {
  ASSET = 'Asset',
  LIABILITY = 'Liability',
  EQUITY = 'Equity',
  REVENUE = 'Revenue',
  EXPENSE = 'Expense',
}

export enum AccountCategory {
  CURRENT_ASSET = 'Current Asset',
  NON_CURRENT_ASSET = 'Non-Current Asset',
  CURRENT_LIABILITY = 'Current Liability',
  LONG_TERM_LIABILITY = 'Long-Term Liability',
  EQUITY = 'Equity',
  OPERATING_REVENUE = 'Operating Revenue',
  OTHER_INCOME = 'Other Income',
  COST_OF_SALES = 'Cost of Sales',
  OPERATING_EXPENSE = 'Operating Expense',
  ADMINISTRATIVE_EXPENSE = 'Administrative Expense',
  MARKETING_EXPENSE = 'Marketing Expense',
  FINANCIAL_EXPENSE = 'Financial Expense',
}

@Entity({ name: 'accounts' })
@Index(['organizationId', 'accountCode'], { unique: true })
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  accountCode: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  accountName: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    nullable: false,
  })
  accountType: AccountType;

  @Column({
    type: 'enum',
    enum: AccountCategory,
    nullable: false,
  })
  accountCategory: AccountCategory;

  @Column({ type: 'uuid', nullable: true })
  parentAccountId: string;

  @ManyToOne(() => Account, (account) => account.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'parentAccountId' })
  parentAccount: Account;

  @OneToMany(() => Account, (account) => account.parentAccount)
  children: Account[];

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystemAccount: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => JournalItem, (item) => item.account)
  journalItems: JournalItem[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
