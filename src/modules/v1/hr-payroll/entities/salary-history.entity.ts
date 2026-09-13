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

@Entity({ name: 'hr_salary_history' })
export class SalaryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  previousBasicSalary: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  newBasicSalary: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  previousGrossSalary: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  newGrossSalary: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  incrementAmount: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  incrementPercentage: number;

  @Column({ type: 'date', nullable: false })
  effectiveDate: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  revisionType: string; // Increment, Promotion, Joining, Adjustment

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  approvedByName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  approvedByUserId: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
