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
import { WebhookDeliveryLog } from './webhook-delivery-log.entity';

@Entity({ name: 'webhook_endpoints' })
@Index(['organizationId', 'url'])
export class WebhookEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  name: string; // e.g. "Custom CRM Sync", "Slack Order Bot"

  @Column({ type: 'varchar', length: 500, nullable: false })
  url: string; // HTTPS target URL

  @Column({ type: 'varchar', length: 100, nullable: false })
  secretKey: string; // HMAC signature secret

  @Column({ type: 'jsonb', nullable: false })
  subscribedEvents: string[]; // ['order.created', 'order.delivered', 'payment.received', 'inventory.updated']

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => WebhookDeliveryLog, (log) => log.endpoint, { cascade: true })
  deliveryLogs: WebhookDeliveryLog[];

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
