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
import { Employee } from './employee.entity';

export enum CommissionType {
  PERCENTAGE_OF_ORDER = 'PercentageOfOrder',
  FLAT_AMOUNT_PER_ORDER = 'FlatAmountPerOrder',
}

@Entity({ name: 'commission_rules' })
@Index(['organizationId', 'name'])
export class CommissionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string; // e.g. "Delivered Order 3% Incentive"

  @Column({
    type: 'enum',
    enum: CommissionType,
    default: CommissionType.PERCENTAGE_OF_ORDER,
  })
  commissionType: CommissionType;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  rate: number; // e.g. 3 for 3% or 50 for 50 Tk

  @Column({ type: 'uuid', nullable: true })
  specificEmployeeId: string; // Null = applies to all agents

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'specificEmployeeId' })
  specificEmployee: Employee;

  @Column({ type: 'int', default: 8 })
  triggerOrderStatusId: number; // Default 8 = Delivered order status

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
