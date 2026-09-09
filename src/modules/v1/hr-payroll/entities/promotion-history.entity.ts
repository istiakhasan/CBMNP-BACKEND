import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Employee } from './employee.entity';
import { Designation } from './designation.entity';
import { Department } from './department.entity';

@Entity({ name: 'promotion_history' })
export class PromotionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @Column({ type: 'varchar', length: 100, nullable: true })
  previousDesignation: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  newDesignation: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  previousSalary: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: false })
  newSalary: number;

  @Column({ type: 'date', nullable: false })
  effectiveDate: string;

  @Column({ type: 'text', nullable: true })
  promotionNotes: string; // Reason / Performance feedback

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
