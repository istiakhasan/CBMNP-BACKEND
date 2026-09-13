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
import { Department } from './department.entity';
import { Designation } from './designation.entity';

export enum TransferStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  COMPLETED = 'Completed',
}

@Entity({ name: 'hr_employee_transfers' })
export class EmployeeTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'uuid', nullable: true })
  fromDepartmentId: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fromDepartmentId' })
  fromDepartment: Department;

  @Column({ type: 'uuid', nullable: true })
  toDepartmentId: string;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'toDepartmentId' })
  toDepartment: Department;

  @Column({ type: 'uuid', nullable: true })
  fromDesignationId: string;

  @ManyToOne(() => Designation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fromDesignationId' })
  fromDesignation: Designation;

  @Column({ type: 'uuid', nullable: true })
  toDesignationId: string;

  @ManyToOne(() => Designation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'toDesignationId' })
  toDesignation: Designation;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fromBranch: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  toBranch: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fromReportingManagerName: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  toReportingManagerId: string;

  @Column({ type: 'date', nullable: false })
  effectiveDate: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({ type: 'text', nullable: true })
  approvalRemarks: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  approvedById: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
