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

export enum NotificationDeliveryStatus {
  SENT = 'Sent',
  FAILED = 'Failed',
}

@Entity({ name: 'sms_logs' })
@Index(['organizationId', 'createdAt'])
export class SmsLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  recipientPhone: string;

  @Column({ type: 'text', nullable: false })
  messageBody: string;

  @Column({
    type: 'enum',
    enum: NotificationDeliveryStatus,
    default: NotificationDeliveryStatus.SENT,
  })
  status: NotificationDeliveryStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gatewayProvider: string; // 'Greenweb', 'SSLWireless', 'Elitbuzz', 'Mock'

  @Column({ type: 'text', nullable: true })
  gatewayResponse: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  orderId: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
