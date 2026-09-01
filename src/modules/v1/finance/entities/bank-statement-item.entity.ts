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
import { BankStatement } from './bank-statement.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'bank_statement_items' })
export class BankStatementItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  statementId: string;

  @ManyToOne(() => BankStatement, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'statementId' })
  statement: BankStatement;

  @Column({ type: 'date', nullable: false })
  transactionDate: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  depositAmount: number; // Cash in

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  withdrawalAmount: number; // Cash out

  @Column({ type: 'boolean', default: false })
  isMatched: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  matchedReferenceType: string; // 'JournalEntry', 'Expense', 'PaymentReceipt'

  @Column({ type: 'varchar', length: 100, nullable: true })
  matchedReferenceId: string;

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
