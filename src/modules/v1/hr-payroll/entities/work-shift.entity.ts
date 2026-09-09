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

@Entity({ name: 'work_shifts' })
export class WorkShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string; // e.g. "Standard Office Shift (09:00 - 18:00)"

  @Column({ type: 'time', nullable: false, default: '09:00:00' })
  startTime: string;

  @Column({ type: 'time', nullable: false, default: '18:00:00' })
  endTime: string;

  @Column({ type: 'int', default: 15 })
  graceMinutes: number; // Grace period before marked Late (e.g. 15 mins)

  @Column({ type: 'numeric', precision: 4, scale: 2, default: 4.0 })
  halfDayHours: number; // Minimum hours required for half-day

  @Column({ type: 'numeric', precision: 4, scale: 2, default: 8.0 })
  fullDayHours: number; // Standard working hours per day

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

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
