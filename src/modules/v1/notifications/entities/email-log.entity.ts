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
import { NotificationDeliveryStatus } from './sms-log.entity';

@Entity({ name: 'email_logs' })
@Index(['organizationId', 'createdAt'])
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  recipientEmail: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  subject: string;

  @Column({ type: 'text', nullable: false })
  bodyHtml: string;

  @Column({
    type: 'enum',
    enum: NotificationDeliveryStatus,
    default: NotificationDeliveryStatus.SENT,
  })
  status: NotificationDeliveryStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  emailType: string; // 'Invoice', 'PurchaseOrder', 'PasswordReset'

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
