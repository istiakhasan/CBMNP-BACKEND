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
import { BankAccount } from './bank-account.entity';
import { BankStatementItem } from './bank-statement-item.entity';

export enum ReconciliationStatus {
  UNRECONCILED = 'Unreconciled',
  PARTIALLY_RECONCILED = 'PartiallyReconciled',
  RECONCILED = 'Reconciled',
}

@Entity({ name: 'bank_statements' })
@Index(['organizationId', 'bankAccountId'])
export class BankStatement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  statementName: string; // e.g. "BRAC Bank Statement - Nov 2025"

  @Column({ type: 'uuid', nullable: false })
  bankAccountId: string;

  @ManyToOne(() => BankAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bankAccountId' })
  bankAccount: BankAccount;

  @Column({ type: 'date', nullable: false })
  startDate: string;

  @Column({ type: 'date', nullable: false })
  endDate: string;

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
  closingBalance: number;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.UNRECONCILED,
  })
  status: ReconciliationStatus;

  @OneToMany(() => BankStatementItem, (item) => item.statement, { cascade: true })
  items: BankStatementItem[];

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
