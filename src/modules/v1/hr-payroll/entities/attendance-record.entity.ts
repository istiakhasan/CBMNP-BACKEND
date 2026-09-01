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
import { Employee } from './employee.entity';
import { Organization } from '../../organization/entities/organization.entity';

export enum AttendanceStatus {
  PRESENT = 'Present',
  LATE = 'Late',
  HALF_DAY = 'HalfDay',
  ABSENT = 'Absent',
  ON_LEAVE = 'OnLeave',
}

@Entity({ name: 'attendance_records' })
@Index(['organizationId', 'employeeId', 'attendanceDate'], { unique: true })
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'date', nullable: false })
  attendanceDate: string;

  @Column({ type: 'time', nullable: true })
  clockInTime: string;

  @Column({ type: 'time', nullable: true })
  clockOutTime: string;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Column({ type: 'int', default: 0 })
  lateMinutes: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  remarks: string;

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
