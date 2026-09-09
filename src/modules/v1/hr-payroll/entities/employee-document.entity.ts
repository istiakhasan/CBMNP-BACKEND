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

@Entity({ name: 'employee_documents' })
export class EmployeeDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'varchar', length: 150, nullable: false })
  documentTitle: string; // e.g. "National ID Card Scan", "Master Certificate", "Signed Employment Contract"

  @Column({ type: 'varchar', length: 100, nullable: false })
  documentType: string; // e.g. "NID/Passport", "Educational Certificate", "Appointment Letter", "NDA", "Driving License"

  @Column({ type: 'text', nullable: false })
  fileUrl: string; // File path / link

  @Column({ type: 'date', nullable: true })
  expiryDate: string; // For Passport, Driving License, Visa, etc.

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
