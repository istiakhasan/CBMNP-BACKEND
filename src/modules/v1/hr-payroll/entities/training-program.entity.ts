import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { TrainingEnrollment } from './training-enrollment.entity';

export enum TrainingStatus {
  PLANNED = 'Planned',
  ONGOING = 'Ongoing',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

@Entity({ name: 'hr_training_programs' })
export class TrainingProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string; // Technical, Soft Skills, Safety, Compliance, etc.

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  trainerName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trainerOrganization: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  venue: string;

  @Column({ type: 'date', nullable: true })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string;

  @Column({ type: 'integer', default: 0 })
  durationHours: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  cost: number;

  @Column({ type: 'integer', nullable: true })
  maxParticipants: number;

  @Column({
    type: 'enum',
    enum: TrainingStatus,
    default: TrainingStatus.PLANNED,
  })
  status: TrainingStatus;

  @Column({ type: 'boolean', default: false })
  hasCertification: boolean;

  @OneToMany(() => TrainingEnrollment, (e) => e.trainingProgram, { cascade: true })
  enrollments: TrainingEnrollment[];

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
