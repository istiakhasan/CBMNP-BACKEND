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
import { Department } from './department.entity';
import { Designation } from './designation.entity';

export enum JobOpeningStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
  CLOSED = 'Closed',
}

@Entity({ name: 'job_openings' })
export class JobOpening {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  title: string; // e.g. "Senior Frontend Developer", "Accounts Executive"

  @Column({ type: 'uuid', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ type: 'uuid', nullable: true })
  designationId: string;

  @ManyToOne(() => Designation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'designationId' })
  designation: Designation;

  @Column({ type: 'int', default: 1 })
  vacanciesCount: number;

  @Column({ type: 'varchar', length: 50, default: 'Full-time' })
  jobType: string; // Full-time, Part-time, Contractual, Intern

  @Column({ type: 'varchar', length: 100, nullable: true })
  experienceRequired: string; // e.g. "2-4 years"

  @Column({ type: 'date', nullable: true })
  applicationDeadline: string;

  @Column({ type: 'text', nullable: true })
  jobDescription: string;

  @Column({ type: 'text', nullable: true })
  requirements: string;

  @Column({
    type: 'enum',
    enum: JobOpeningStatus,
    default: JobOpeningStatus.PUBLISHED,
  })
  status: JobOpeningStatus;

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
