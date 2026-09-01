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

export enum ApprovalModuleType {
  EXPENSE = 'Expense',
  PURCHASE_ORDER = 'PurchaseOrder',
  STOCK_ADJUSTMENT = 'StockAdjustment',
  LEAVE = 'Leave',
  CREDIT_OVERRIDE = 'CreditOverride',
}

@Entity({ name: 'approval_rules' })
@Index(['organizationId', 'moduleType'])
export class ApprovalRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ApprovalModuleType,
    nullable: false,
  })
  moduleType: ApprovalModuleType;

  @Column({ type: 'varchar', length: 100, nullable: false })
  ruleName: string; // e.g. "Expense > 10,000 Tk requires Director approval"

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  thresholdAmount: number;

  @Column({ type: 'varchar', length: 50, default: 'admin' })
  requiredRole: string; // 'admin', 'manager', 'owner'

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
