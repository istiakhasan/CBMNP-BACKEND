import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { Customers } from '../../customers/entities/customers.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'coupon_usages' })
@Index(['organizationId', 'couponId', 'customerId'])
export class CouponUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  couponId: string;

  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Column({ type: 'int', nullable: false })
  @Index()
  customerId: number;

  @ManyToOne(() => Customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customers;

  @Column({ type: 'varchar', length: 100, nullable: true })
  orderId: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  discountApplied: number;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
