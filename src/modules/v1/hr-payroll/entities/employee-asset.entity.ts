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

export enum AssetStatus {
  ASSIGNED = 'Assigned',
  RETURNED = 'Returned',
  DAMAGED = 'Damaged',
  LOST = 'Lost',
}

@Entity({ name: 'employee_assets' })
export class EmployeeAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'varchar', length: 150, nullable: false })
  assetName: string; // e.g. "Dell Latitude 5420 Laptop", "Company SIM Card", "Master Door Key"

  @Column({ type: 'varchar', length: 100, nullable: true })
  assetCode: string; // e.g. "AST-IT-0042"

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string; // e.g. "IT Hardware", "Vehicle", "Keys & Access", "Phone / SIM"

  @Column({ type: 'date', nullable: false })
  assignedDate: string;

  @Column({ type: 'date', nullable: true })
  returnDate: string;

  @Column({
    type: 'enum',
    enum: AssetStatus,
    default: AssetStatus.ASSIGNED,
  })
  status: AssetStatus;

  @Column({ type: 'text', nullable: true })
  conditionNotes: string; // e.g. "Good condition with charger and bag"

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
