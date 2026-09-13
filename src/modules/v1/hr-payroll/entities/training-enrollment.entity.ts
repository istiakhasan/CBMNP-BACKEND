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
import { TrainingProgram } from './training-program.entity';

export enum EnrollmentStatus {
  ENROLLED = 'Enrolled',
  ATTENDED = 'Attended',
  COMPLETED = 'Completed',
  ABSENT = 'Absent',
  CANCELLED = 'Cancelled',
}

@Entity({ name: 'hr_training_enrollments' })
export class TrainingEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  trainingProgramId: string;

  @ManyToOne(() => TrainingProgram, (tp) => tp.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainingProgramId' })
  trainingProgram: TrainingProgram;

  @Column({ type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.ENROLLED,
  })
  status: EnrollmentStatus;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  score: number; // test/exam score if applicable

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'boolean', default: false })
  certificateIssued: boolean;

  @Column({ type: 'date', nullable: true })
  certificateExpiryDate: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
