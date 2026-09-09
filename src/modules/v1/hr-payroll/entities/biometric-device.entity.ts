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

export enum BiometricDeviceStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  MAINTENANCE = 'Maintenance',
}

@Entity({ name: 'biometric_devices' })
@Index(['organizationId', 'apiKey'], { unique: true })
export class BiometricDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  name: string; // e.g. "Main Office Entrance", "Warehouse Door 1"

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceSerial: string; // Hardware serial number e.g. "ZK-2026-X800"

  @Column({ type: 'varchar', length: 150, nullable: false, unique: true })
  @Index()
  apiKey: string; // Unique secure token for device HTTP push/webhook authentication

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string; // Device IP if local/static

  @Column({ type: 'int', nullable: true, default: 4370 })
  port: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string; // e.g. "Dhaka Head Office", "Chittagong Hub"

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'ZKTeco / Universal' })
  deviceModel: string; // e.g. "ZKTeco K40", "Hikvision DS-K1T804", "Realtime T52"

  @Column({
    type: 'enum',
    enum: BiometricDeviceStatus,
    default: BiometricDeviceStatus.ACTIVE,
  })
  status: BiometricDeviceStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  @Column({ type: 'int', default: 0 })
  totalPunchesRecorded: number;

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
