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
import { JobOpening } from './job-opening.entity';
import { Employee } from './employee.entity';

export enum ApplicationStage {
  APPLIED = 'Applied',
  SCREENING = 'Screening',
  INTERVIEW = 'Interview',
  OFFERED = 'Offered',
  HIRED = 'Hired',
  REJECTED = 'Rejected',
}

@Entity({ name: 'job_applications' })
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  jobOpeningId: string;

  @ManyToOne(() => JobOpening, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobOpeningId' })
  jobOpening: JobOpening;

  @Column({ type: 'varchar', length: 150, nullable: false })
  candidateName: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  candidateEmail: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  candidatePhone: string;

  @Column({ type: 'text', nullable: true })
  resumeUrl: string; // Link/Path to resume or portfolio

  @Column({ type: 'text', nullable: true })
  coverLetter: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  expectedSalary: number;

  @Column({
    type: 'enum',
    enum: ApplicationStage,
    default: ApplicationStage.APPLIED,
  })
  stage: ApplicationStage;

  @Column({ type: 'timestamp', nullable: true })
  interviewDate: Date;

  @Column({ type: 'int', nullable: true })
  rating: number; // 1 to 5 stars

  @Column({ type: 'text', nullable: true })
  interviewerNotes: string;

  @Column({ type: 'uuid', nullable: true })
  convertedEmployeeId: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'convertedEmployeeId' })
  convertedEmployee: Employee;

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
