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
import { PayrollItem } from './payroll-item.entity';

export enum PayrollStatus {
  DRAFT = 'Draft',
  APPROVED = 'Approved',
  DISBURSED = 'Disbursed',
}

@Entity({ name: 'payroll_sheets' })
@Index(['organizationId', 'year', 'month'], { unique: true })
export class PayrollSheet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', nullable: false })
  year: number; // e.g. 2025

  @Column({ type: 'int', nullable: false })
  month: number; // 1 to 12

  @Column({ type: 'varchar', length: 100, nullable: false })
  sheetName: string; // e.g. "Payroll - Nov 2025"

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalGrossSalary: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalDeductions: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalCommissions: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalNetSalary: number;

  @Column({
    type: 'enum',
    enum: PayrollStatus,
    default: PayrollStatus.DRAFT,
  })
  status: PayrollStatus;

  @Column({ type: 'date', nullable: true })
  disbursedDate: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedById: string;

  @OneToMany(() => PayrollItem, (pi) => pi.payrollSheet, { cascade: true })
  items: PayrollItem[];

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
