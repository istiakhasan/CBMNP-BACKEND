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
import { BiometricDevice } from './biometric-device.entity';
import { Organization } from '../../organization/entities/organization.entity';

export enum AttendanceStatus {
  PRESENT = 'Present',
  LATE = 'Late',
  HALF_DAY = 'HalfDay',
  ABSENT = 'Absent',
  ON_LEAVE = 'OnLeave',
}

export enum PunchSource {
  BIOMETRIC = 'BiometricDevice',
  WEB_MANUAL = 'WebManual',
  MOBILE = 'Mobile',
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

  @Column({ type: 'int', default: 0 })
  earlyLeavingMinutes: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  workHours: number; // Total hours worked (e.g. 8.5)

  @Column({ type: 'int', default: 0 })
  overtimeMinutes: number;

  @Column({
    type: 'enum',
    enum: PunchSource,
    default: PunchSource.WEB_MANUAL,
  })
  punchSource: PunchSource;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  deviceId: string;

  @ManyToOne(() => BiometricDevice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deviceId' })
  device: BiometricDevice;

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
