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
import { DeliveryPartner } from '../../delivery-partner/entities/delivery-partner.entity';

export enum SettlementStatus {
  UNRECONCILED = 'Unreconciled',
  RECONCILED = 'Reconciled',
  DISCREPANCY = 'Discrepancy',
}

@Entity({ name: 'courier_settlements' })
@Index(['organizationId', 'settlementNumber'], { unique: true })
export class CourierSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  settlementNumber: string; // e.g. "SETTLE-2025-000001"

  @Column({ type: 'date', nullable: false })
  settlementDate: string;

  @Column({ type: 'uuid', nullable: false })
  courierPartnerId: string;

  @ManyToOne(() => DeliveryPartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'courierPartnerId' })
  courierPartner: DeliveryPartner;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalCodCollected: number; // Stated by carrier

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalDeliveryCharges: number; // Deducted by carrier

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  netDisbursedAmount: number; // Deposited to merchant bank

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  systemExpectedAmount: number; // Sum of ERP order COD amounts

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  variance: number; // netDisbursedAmount - systemExpectedAmount

  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.UNRECONCILED,
  })
  status: SettlementStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankDepositReference: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

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
