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
import { DeliveryPartner } from '../../delivery-partner/entities/delivery-partner.entity';

@Entity({ name: 'courier_routing_rules' })
@Index(['organizationId', 'priority'])
export class CourierRoutingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  ruleName: string; // e.g. "Dhaka Inside City - Express", "Outside Dhaka Heavy Goods"

  @Column({ type: 'int', default: 1 })
  priority: number; // 1 = Highest priority

  @Column({ type: 'uuid', nullable: false })
  courierPartnerId: string;

  @ManyToOne(() => DeliveryPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courierPartnerId' })
  courierPartner: DeliveryPartner;

  @Column({ type: 'varchar', length: 100, nullable: true })
  division: string; // Null = Any division

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  maxWeightKg: number;

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
