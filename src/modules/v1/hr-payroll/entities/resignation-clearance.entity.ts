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

export enum ClearanceStatus {
  SUBMITTED = 'Submitted',
  IN_PROGRESS = 'In Progress',
  CLEARED = 'Cleared & Settled',
  REJECTED = 'Rejected',
}

@Entity({ name: 'resignation_clearances' })
export class ResignationClearance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'date', nullable: false })
  resignationDate: string;

  @Column({ type: 'date', nullable: false })
  lastWorkingDay: string;

  @Column({ type: 'text', nullable: false })
  reasonForLeaving: string;

  @Column({ type: 'boolean', default: false })
  itClearanceApproved: boolean;

  @Column({ type: 'boolean', default: false })
  adminAssetClearanceApproved: boolean;

  @Column({ type: 'boolean', default: false })
  accountsDuesClearanceApproved: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  finalSettlementAmount: number; // Gratuity + remaining salary - deductions

  @Column({
    type: 'enum',
    enum: ClearanceStatus,
    default: ClearanceStatus.SUBMITTED,
  })
  status: ClearanceStatus;

  @Column({ type: 'text', nullable: true })
  exitInterviewFeedback: string;

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
