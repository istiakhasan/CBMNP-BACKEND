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

export enum ReviewStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted',
  ACKNOWLEDGED = 'Acknowledged',
  COMPLETED = 'Completed',
}

export enum PerformanceRating {
  OUTSTANDING = 'Outstanding',
  EXCEEDS_EXPECTATIONS = 'Exceeds Expectations',
  MEETS_EXPECTATIONS = 'Meets Expectations',
  NEEDS_IMPROVEMENT = 'Needs Improvement',
  UNSATISFACTORY = 'Unsatisfactory',
}

@Entity({ name: 'hr_performance_reviews' })
export class PerformanceReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'varchar', length: 100 })
  reviewCycle: string; // e.g. "Q3 2026", "Annual 2026"

  @Column({ type: 'date', nullable: true })
  reviewPeriodStart: string;

  @Column({ type: 'date', nullable: true })
  reviewPeriodEnd: string;

  @Column({ type: 'date', nullable: true })
  reviewDate: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  reviewedByName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  reviewedByUserId: string;

  // KPI/KRA scores
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  selfRatingScore: number; // 0-100

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  managerRatingScore: number; // 0-100

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  finalScore: number;

  @Column({
    type: 'enum',
    enum: PerformanceRating,
    nullable: true,
  })
  rating: PerformanceRating;

  @Column({ type: 'text', nullable: true })
  selfEvaluation: string;

  @Column({ type: 'text', nullable: true })
  managerComments: string;

  @Column({ type: 'text', nullable: true })
  goals: string; // next period goals

  @Column({ type: 'text', nullable: true })
  trainingRecommendations: string;

  @Column({ type: 'jsonb', nullable: true })
  kpiDetails: Array<{ kpi: string; target: string; achieved: string; score: number }>;

  @Column({
    type: 'enum',
    enum: ReviewStatus,
    default: ReviewStatus.DRAFT,
  })
  status: ReviewStatus;

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
