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

export enum AnnouncementType {
  GENERAL = 'General',
  POLICY = 'Policy Update',
  HOLIDAY = 'Holiday Notice',
  PAYROLL = 'Payroll',
  RECRUITMENT = 'Recruitment',
  EVENT = 'Event',
  URGENT = 'Urgent',
}

@Entity({ name: 'hr_announcements' })
export class HrAnnouncement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: AnnouncementType,
    default: AnnouncementType.GENERAL,
  })
  announcementType: AnnouncementType;

  @Column({ type: 'date', nullable: true })
  publishDate: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 150, nullable: true })
  postedByName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  postedByUserId: string;

  @Column({ type: 'simple-array', nullable: true })
  targetDepartments: string[]; // empty = all departments

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
