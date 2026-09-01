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

export enum TargetPeriod {
  MONTHLY = 'Monthly',
  QUARTERLY = 'Quarterly',
  YEARLY = 'Yearly',
}

@Entity({ name: 'sales_targets' })
@Index(['organizationId', 'employeeId', 'year', 'periodValue'])
export class SalesTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({
    type: 'enum',
    enum: TargetPeriod,
    default: TargetPeriod.MONTHLY,
  })
  periodType: TargetPeriod;

  @Column({ type: 'int', nullable: false })
  year: number;

  @Column({ type: 'int', nullable: false })
  periodValue: number; // Month (1-12) or Quarter (1-4)

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  targetRevenue: number;

  @Column({ type: 'int', default: 0 })
  targetOrdersCount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  achievedRevenue: number;

  @Column({ type: 'int', default: 0 })
  achievedOrdersCount: number;

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
