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
import { EmployeeLoan } from './employee-loan.entity';

@Entity({ name: 'hr_loan_repayments' })
export class LoanRepayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  loanId: string;

  @ManyToOne(() => EmployeeLoan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: EmployeeLoan;

  @Column({ type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'integer' })
  installmentNumber: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  paymentDate: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod: string; // Payroll Deduction, Cash, Bank Transfer

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  outstandingAfterPayment: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  recordedByUserId: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
