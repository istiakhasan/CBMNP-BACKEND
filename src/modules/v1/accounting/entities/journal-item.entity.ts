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
import { Account } from './account.entity';
import { JournalEntry } from './journal-entry.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'journal_items' })
export class JournalItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journalEntryId' })
  journalEntry: JournalEntry;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  accountId: string;

  @ManyToOne(() => Account, (account) => account.journalItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  debit: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  credit: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  memo: string;

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
