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

export enum HolidayType {
  PUBLIC = 'Public Holiday',
  FESTIVAL = 'Festival / Religious',
  COMPANY = 'Company Special',
  WEEKLY_OFF = 'Weekly Weekend',
}
export enum HolidayApprovalStatus { PENDING = 'Pending', APPROVED = 'Approved', REJECTED = 'Rejected' }

@Entity({ name: 'holidays' })
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  name: string; // e.g. "Eid-ul-Fitr", "Independence Day", "International Mother Language Day"

  @Column({ type: 'date', nullable: false })
  fromDate: string;

  @Column({ type: 'date', nullable: false })
  toDate: string;

  @Column({ type: 'int', default: 1 })
  totalDays: number;

  @Column({
    type: 'enum',
    enum: HolidayType,
    default: HolidayType.PUBLIC,
  })
  holidayType: HolidayType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: HolidayApprovalStatus, default: HolidayApprovalStatus.PENDING })
  approvalStatus: HolidayApprovalStatus;

  @Column({ type: 'uuid', nullable: true }) approverEmployeeId: string;
  @Column({ type: 'uuid', nullable: true }) approvedByEmployeeId: string;
  @Column({ type: 'text', nullable: true }) approvalRemarks: string;

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
