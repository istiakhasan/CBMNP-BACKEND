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
import { Employee } from './employee.entity';
import { Order } from '../../order/entities/order.entity';

export enum CommissionRecordStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  PAID = 'Paid',
  CANCELLED = 'Cancelled',
}

@Entity({ name: 'commission_records' })
@Index(['organizationId', 'employeeId'])
@Index(['organizationId', 'orderId'])
export class CommissionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'varchar', length: 100, nullable: false })
  orderId: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  orderAmount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  commissionAmount: number;

  @Column({
    type: 'enum',
    enum: CommissionRecordStatus,
    default: CommissionRecordStatus.PENDING,
  })
  status: CommissionRecordStatus;

  @Column({ type: 'date', nullable: false })
  earnedDate: string;

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
