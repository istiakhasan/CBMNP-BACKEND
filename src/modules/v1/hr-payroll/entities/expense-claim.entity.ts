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
import { ApprovalStage } from './approval-stage.enum';

export enum ExpenseClaimStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REIMBURSED = 'Reimbursed',
  REJECTED = 'Rejected',
}

@Entity({ name: 'expense_claims' })
export class ExpenseClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'varchar', length: 100, nullable: false })
  category: string; // e.g. "Travel & Conveyance", "Client Entertainment", "Office Supplies", "Medical"

  @Column({ type: 'date', nullable: false })
  expenseDate: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column({ type: 'text', nullable: true })
  receiptUrl: string; // Attachment/receipt path or link

  @Column({
    type: 'enum',
    enum: ExpenseClaimStatus,
    default: ExpenseClaimStatus.PENDING,
  })
  status: ExpenseClaimStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedById: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'enum', enum: ApprovalStage, nullable: true })
  approvalStage: ApprovalStage;

  @Column({ type: 'uuid', nullable: true })
  deptHeadApprovedById: string;

  @Column({ type: 'timestamp', nullable: true })
  deptHeadActionAt: Date;

  @Column({ type: 'text', nullable: true })
  deptHeadRemarks: string;

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
