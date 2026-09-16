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

@Entity({ name: 'departments' })
@Index(['organizationId', 'name'], { unique: true })
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string; // e.g. "Sales & Marketing", "Warehouse & Logistics", "Accounts", "Customer Support"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // JSON array of weekday indexes (0=Sunday ... 6=Saturday). Empty means company default.
  @Column({ type: 'simple-json', nullable: true })
  weeklyOffDays: number[];

  // Department Head — first-stage approver for this department's leave/expense/overtime/
  // attendance-correction requests. Requests from an employee in this department go to
  // this person before moving on to a designated Final Approver (e.g. CCO/CEO).
  @Column({ type: 'uuid', nullable: true })
  headEmployeeId: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'headEmployeeId' })
  headEmployee: Employee;

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
