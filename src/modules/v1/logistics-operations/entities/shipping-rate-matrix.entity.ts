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

@Entity({ name: 'shipping_rate_matrices' })
@Index(['organizationId', 'courierPartnerId', 'zoneType'])
export class ShippingRateMatrix {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  courierPartnerId: string;

  @ManyToOne(() => DeliveryPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courierPartnerId' })
  courierPartner: DeliveryPartner;

  @Column({ type: 'varchar', length: 100, nullable: false })
  zoneType: string; // "Inside Dhaka", "Dhaka Suburb", "Outside Dhaka"

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 1.0,
  })
  baseWeightKg: number; // e.g. 1 kg

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  baseRate: number; // e.g. 70 Tk for first 1kg

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 20.0,
  })
  additionalKgRate: number; // e.g. +20 Tk for every next kg

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 1.0,
  })
  codPercentageFee: number; // e.g. 1% COD handling fee

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
