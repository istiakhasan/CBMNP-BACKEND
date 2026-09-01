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
import { Employee } from './employee.entity';
import { LeaveType } from './leave-type.entity';
import { Organization } from '../../organization/entities/organization.entity';

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  CANCELLED = 'Cancelled',
}

@Entity({ name: 'leave_requests' })
@Index(['organizationId', 'employeeId'])
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'uuid', nullable: false })
  leaveTypeId: string;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leaveTypeId' })
  leaveType: LeaveType;

  @Column({ type: 'date', nullable: false })
  startDate: string;

  @Column({ type: 'date', nullable: false })
  endDate: string;

  @Column({ type: 'int', nullable: false })
  daysCount: number;

  @Column({ type: 'text', nullable: false })
  reason: string;

  @Column({
    type: 'enum',
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
  })
  status: LeaveStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedById: string;

  @Column({ type: 'text', nullable: true })
  approvalRemarks: string;

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
