import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WebhookEndpoint } from './webhook-endpoint.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'webhook_delivery_logs' })
@Index(['organizationId', 'createdAt'])
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  endpointId: string;

  @ManyToOne(() => WebhookEndpoint, (ep) => ep.deliveryLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpointId' })
  endpoint: WebhookEndpoint;

  @Column({ type: 'varchar', length: 100, nullable: false })
  eventName: string; // 'order.created', 'order.delivered'

  @Column({ type: 'jsonb', nullable: false })
  payload: any;

  @Column({ type: 'int', nullable: true })
  responseStatusCode: number; // e.g. 200, 500

  @Column({ type: 'text', nullable: true })
  responseBody: string;

  @Column({ type: 'int', default: 1 })
  attemptCount: number;

  @Column({ type: 'boolean', default: false })
  isSuccess: boolean;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
