import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'audit_logs' })
@Index(['organizationId', 'createdAt'])
@Index(['organizationId', 'entityName', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  entityName: string; // 'Order', 'Product', 'StockAdjustment', 'JournalEntry', 'Expense'

  @Column({ type: 'varchar', length: 100, nullable: false })
  entityId: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  actionType: string; // 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'VOID'

  @Column({ type: 'jsonb', nullable: true })
  previousValues: any;

  @Column({ type: 'jsonb', nullable: true })
  newValues: any;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
