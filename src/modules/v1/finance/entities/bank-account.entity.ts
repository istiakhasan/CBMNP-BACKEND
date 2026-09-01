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
import { Account } from '../../accounting/entities/account.entity';

export enum BankAccountType {
  BANK = 'Bank',
  CASH = 'Cash',
  MFS = 'MFS', // bKash, Nagad, Rocket, Upay
  PETTY_CASH = 'PettyCash',
}

@Entity({ name: 'bank_accounts' })
@Index(['organizationId', 'accountNumber'], { unique: true })
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  accountName: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  accountNumber: string;

  @Column({
    type: 'enum',
    enum: BankAccountType,
    default: BankAccountType.BANK,
  })
  accountType: BankAccountType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string; // e.g. "BRAC Bank", "City Bank", "bKash Merchant"

  @Column({ type: 'varchar', length: 100, nullable: true })
  branchName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  routingNumber: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  openingBalance: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  currentBalance: number;

  @Column({ type: 'uuid', nullable: true })
  linkedGlAccountId: string;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linkedGlAccountId' })
  linkedGlAccount: Account;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
