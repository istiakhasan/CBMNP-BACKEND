import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { PosCashMovement } from './pos-cash-movement.entity';

export enum PosSessionStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
}

@Entity({ name: 'pos_register_sessions' })
@Index(['organizationId', 'cashierId', 'status'])
export class PosRegisterSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  sessionNumber: string; // e.g. "POS-SESS-2025-000001"

  @Column({ type: 'varchar', length: 100, nullable: false })
  cashierId: string; // User ID of cashier

  @Column({ type: 'uuid', nullable: true })
  warehouseId: string; // Counter location/branch

  @ManyToOne(() => Warehouse, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'timestamp', nullable: false })
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  openingCash: number; // Starting float cash

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalCashSales: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalMfsSales: number; // bKash/Nagad

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalCashIn: number; // Mid-day drawer top-up

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  totalCashOut: number; // Petty expenses paid from drawer

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  expectedClosingCash: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  actualClosingCash: number; // Counted by cashier at shift close

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  cashVariance: number; // actualClosingCash - expectedClosingCash

  @Column({
    type: 'enum',
    enum: PosSessionStatus,
    default: PosSessionStatus.OPEN,
  })
  status: PosSessionStatus;

  @Column({ type: 'text', nullable: true })
  closingNotes: string;

  @OneToMany(() => PosCashMovement, (cm) => cm.session, { cascade: true })
  movements: PosCashMovement[];

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
