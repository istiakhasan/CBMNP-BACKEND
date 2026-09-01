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

export enum CouponDiscountType {
  PERCENTAGE = 'Percentage',
  FLAT_AMOUNT = 'FlatAmount',
}

@Entity({ name: 'coupons' })
@Index(['organizationId', 'code'], { unique: true })
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  code: string; // e.g. "EID2025" or "WELCOME100"

  @Column({
    type: 'enum',
    enum: CouponDiscountType,
    default: CouponDiscountType.PERCENTAGE,
  })
  discountType: CouponDiscountType;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  discountValue: number; // e.g. 10 for 10% or 100 for 100 Tk

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  minOrderValue: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  maxDiscountAmount: number; // For percentage caps

  @Column({ type: 'date', nullable: true })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string;

  @Column({ type: 'int', default: 0 })
  usageLimitPerCustomer: number; // 0 = unlimited

  @Column({ type: 'int', default: 0 })
  totalUsageLimit: number; // 0 = unlimited

  @Column({ type: 'int', default: 0 })
  timesUsed: number;

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
