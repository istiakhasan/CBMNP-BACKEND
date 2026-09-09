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

export enum LoanStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  RUNNING = 'Running',
  PAID = 'Paid',
  REJECTED = 'Rejected',
}

export enum LoanType {
  SALARY_ADVANCE = 'Salary Advance',
  COMPANY_LOAN = 'Company Loan',
  EMERGENCY_FUND = 'Emergency Fund',
}

@Entity({ name: 'employee_loans' })
export class EmployeeLoan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({
    type: 'enum',
    enum: LoanType,
    default: LoanType.SALARY_ADVANCE,
  })
  loanType: LoanType;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: false })
  principalAmount: number; // Total loan requested (e.g. 50,000 BDT)

  @Column({ type: 'int', default: 1 })
  totalInstallments: number; // Number of months to repay (e.g. 5 months)

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: false })
  monthlyEmiAmount: number; // Installment per month (e.g. 10,000 BDT)

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  totalPaidAmount: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: LoanStatus,
    default: LoanStatus.PENDING,
  })
  status: LoanStatus;

  @Column({ type: 'date', nullable: true })
  disbursedDate: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedById: string;

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
