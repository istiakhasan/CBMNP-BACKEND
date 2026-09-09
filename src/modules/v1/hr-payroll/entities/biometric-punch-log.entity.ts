import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BiometricDevice } from './biometric-device.entity';
import { Employee } from './employee.entity';
import { Organization } from '../../organization/entities/organization.entity';

export enum PunchDirection {
  CHECK_IN = 'CheckIn',
  CHECK_OUT = 'CheckOut',
  AUTO = 'Auto',
}

@Entity({ name: 'biometric_punch_logs' })
export class BiometricPunchLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  deviceId: string;

  @ManyToOne(() => BiometricDevice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deviceId' })
  device: BiometricDevice;

  @Column({ type: 'varchar', length: 100, nullable: false })
  @Index()
  biometricUserId: string; // ID assigned on the physical device (e.g. "1001", "0052")

  @Column({ type: 'timestamp', nullable: false })
  punchTime: Date;

  @Column({
    type: 'enum',
    enum: PunchDirection,
    default: PunchDirection.AUTO,
  })
  punchType: PunchDirection;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'Fingerprint' })
  verifyType: string; // e.g. "Fingerprint", "Face", "Card", "Password"

  @Column({ type: 'uuid', nullable: true })
  @Index()
  matchedEmployeeId: string;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'matchedEmployeeId' })
  matchedEmployee: Employee;

  @Column({ type: 'boolean', default: true })
  isProcessed: boolean;

  @Column({ type: 'text', nullable: true })
  rawPayload: string; // Full JSON payload received from the device for audit trails

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
