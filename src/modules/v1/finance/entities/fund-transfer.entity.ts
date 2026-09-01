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
import { BankAccount } from './bank-account.entity';

@Entity({ name: 'fund_transfers' })
@Index(['organizationId', 'transferNumber'], { unique: true })
export class FundTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  transferNumber: string;

  @Column({ type: 'date', nullable: false })
  transferDate: string;

  @Column({ type: 'uuid', nullable: false })
  fromBankAccountId: string;

  @ManyToOne(() => BankAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fromBankAccountId' })
  fromBankAccount: BankAccount;

  @Column({ type: 'uuid', nullable: false })
  toBankAccountId: string;

  @ManyToOne(() => BankAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'toBankAccountId' })
  toBankAccount: BankAccount;

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
  transactionFee: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber: string;

  @Column({ type: 'text', nullable: true })
  note: string;

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
