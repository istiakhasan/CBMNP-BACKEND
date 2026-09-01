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

export enum NotificationTriggerEvent {
  ORDER_CREATED = 'OrderCreated',
  ORDER_APPROVED = 'OrderApproved',
  ORDER_DISPATCHED = 'OrderDispatched',
  ORDER_DELIVERED = 'OrderDelivered',
  ORDER_CANCELLED = 'OrderCancelled',
  PAYMENT_RECEIVED = 'PaymentReceived',
}

@Entity({ name: 'sms_templates' })
@Index(['organizationId', 'triggerEvent'], { unique: true })
export class SmsTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: NotificationTriggerEvent,
    nullable: false,
  })
  triggerEvent: NotificationTriggerEvent;

  @Column({ type: 'text', nullable: false })
  templateBody: string; // e.g. "Dear {{customerName}}, your order {{orderId}} of Tk {{amount}} has been dispatched with tracking #{{trackingCode}}. Thanks for shopping with us!"

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
