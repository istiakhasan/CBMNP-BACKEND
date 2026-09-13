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

export enum DisciplinaryType {
  VERBAL_WARNING = 'Verbal Warning',
  WRITTEN_WARNING = 'Written Warning',
  SHOW_CAUSE = 'Show Cause Notice',
  SUSPENSION = 'Suspension',
  DEMOTION = 'Demotion',
  TERMINATION = 'Termination',
  OTHER = 'Other',
}

export enum DisciplinaryStatus {
  OPEN = 'Open',
  RESPONSE_RECEIVED = 'Response Received',
  UNDER_INVESTIGATION = 'Under Investigation',
  RESOLVED = 'Resolved',
  CLOSED = 'Closed',
}

@Entity({ name: 'hr_disciplinary_actions' })
export class DisciplinaryAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({
    type: 'enum',
    enum: DisciplinaryType,
    default: DisciplinaryType.WRITTEN_WARNING,
  })
  actionType: DisciplinaryType;

  @Column({ type: 'date' })
  incidentDate: string;

  @Column({ type: 'date', nullable: true })
  actionDate: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  employeeResponse: string;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({
    type: 'enum',
    enum: DisciplinaryStatus,
    default: DisciplinaryStatus.OPEN,
  })
  status: DisciplinaryStatus;

  @Column({ type: 'varchar', length: 150, nullable: true })
  issuedByName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  issuedByUserId: string;

  @Column({ type: 'date', nullable: true })
  responseDeadline: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
