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
import { Users } from '../../user/entities/user.entity';

export enum EmploymentStatus {
  ACTIVE = 'Active',
  PROBATION = 'Probation',
  RESIGNED = 'Resigned',
  TERMINATED = 'Terminated',
  SUSPENDED = 'Suspended',
}

export enum EmploymentType {
  FULL_TIME = 'Full-time',
  PART_TIME = 'Part-time',
  CONTRACTUAL = 'Contractual',
  INTERN = 'Intern',
}

export enum PaymentMethod {
  BANK = 'Bank Transfer',
  MFS = 'bKash / Nagad',
  CASH = 'Cash',
}

@Entity({ name: 'employees' })
@Index(['organizationId', 'employeeCode'], { unique: true })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  employeeCode: string; // e.g. "EMP-001"

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  biometricUserId: string; // ID / Fingerprint Card No on the Biometric Machine (e.g. "1001")

  @Column({ type: 'varchar', length: 150, nullable: false })
  fullName: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  phone: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nidNumber: string; // National ID or Passport

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string; // Male, Female, Other

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bloodGroup: string; // A+, B+, O+, AB+, etc.

  @Column({ type: 'varchar', length: 30, nullable: true })
  maritalStatus: string; // Single, Married, etc.

  @Column({ type: 'text', nullable: true })
  presentAddress: string;

  @Column({ type: 'text', nullable: true })
  permanentAddress: string;

  // Emergency Contact
  @Column({ type: 'varchar', length: 150, nullable: true })
  emergencyContactName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  emergencyContactPhone: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  emergencyContactRelation: string;

  // Linked system login user
  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string;

  @ManyToOne(() => Users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'userId' })
  user: Users;

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

  @Column({ type: 'uuid', nullable: true })
  reportingManagerId: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportingManagerId' })
  reportingManager: Employee;

  @Column({ type: 'date', nullable: true })
  joiningDate: string;

  @Column({ type: 'date', nullable: true })
  confirmationDate: string;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({
    type: 'enum',
    enum: EmploymentStatus,
    default: EmploymentStatus.ACTIVE,
  })
  status: EmploymentStatus;

  // Compensation & Bank details
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  basicSalary: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankAccountNo: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bankRoutingNo: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mfsNumber: string; // bKash or Nagad wallet number

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.BANK,
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tinNumber: string;

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
