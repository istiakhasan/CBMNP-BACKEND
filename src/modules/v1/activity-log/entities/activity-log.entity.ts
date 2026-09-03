import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'activity_logs' })
@Index(['organizationId', 'createdAt'])
@Index(['organizationId', 'module'])
@Index(['organizationId', 'action'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  organizationId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  userName: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  module: string;

  @Column({ type: 'varchar', length: 80, nullable: false })
  action: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  method: string;

  @Column({ type: 'text', nullable: true })
  path: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string;

  @Column({ type: 'int', nullable: true })
  statusCode: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
