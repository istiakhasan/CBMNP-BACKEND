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
import { Customers } from '../../customers/entities/customers.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'customer_credit_profiles' })
@Index(['organizationId', 'customerId'], { unique: true })
export class CustomerCreditProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', nullable: false })
  customerId: number;

  @ManyToOne(() => Customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customers;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  creditLimit: number; // 0 = No credit allowed

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  currentDueAmount: number;

  @Column({ type: 'boolean', default: false })
  isBlocked: boolean; // Block order placement if credit limit exceeded

  @Column({ type: 'varchar', length: 255, nullable: true })
  blockReason: string;

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
