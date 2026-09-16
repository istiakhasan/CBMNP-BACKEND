import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { BiometricDevice } from './biometric-device.entity';

/**
 * Last known roster read from a biometric device.  This cache lets the SaaS
 * application display enrolled users even when the physical device is only
 * reachable from an office LAN.
 */
@Entity({ name: 'biometric_enrolled_users' })
@Index(['organizationId', 'deviceId', 'deviceUserId'], { unique: true })
export class BiometricEnrolledUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @Column({ type: 'uuid' })
  @Index()
  deviceId: string;

  @Column({ type: 'varchar', length: 100 })
  deviceUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cardNumber: string;

  @Column({ type: 'timestamp' })
  lastSyncedAt: Date;

  @ManyToOne(() => BiometricDevice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: BiometricDevice;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
