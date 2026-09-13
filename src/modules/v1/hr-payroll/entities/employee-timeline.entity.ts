import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Employee } from './employee.entity';

export enum TimelineEventType {
  JOINING = 'Joining',
  PROBATION_START = 'Probation Start',
  PROBATION_END = 'Probation End',
  CONFIRMATION = 'Confirmation',
  PROMOTION = 'Promotion',
  TRANSFER = 'Transfer',
  DEPARTMENT_CHANGE = 'Department Change',
  DESIGNATION_CHANGE = 'Designation Change',
  SALARY_REVISION = 'Salary Revision',
  LEAVE = 'Leave',
  ATTENDANCE_CORRECTION = 'Attendance Correction',
  DISCIPLINARY = 'Disciplinary Action',
  TRAINING = 'Training',
  PERFORMANCE_REVIEW = 'Performance Review',
  RESIGNATION = 'Resignation',
  CLEARANCE = 'Clearance',
  TERMINATION = 'Termination',
  STATUS_CHANGE = 'Status Change',
  OTHER = 'Other',
}

@Entity({ name: 'hr_employee_timeline' })
export class EmployeeTimeline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({
    type: 'enum',
    enum: TimelineEventType,
    default: TimelineEventType.OTHER,
  })
  eventType: TimelineEventType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date', nullable: true })
  eventDate: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // flexible: old/new dept, salary, etc.

  @Column({ type: 'varchar', length: 150, nullable: true })
  performedByName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  performedByUserId: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
