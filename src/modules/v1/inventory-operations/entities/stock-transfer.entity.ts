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
import { StockTransferItem } from './stock-transfer-item.entity';

export enum StockTransferStatus {
  DRAFT = 'Draft',
  APPROVED = 'Approved',
  DISPATCHED = 'Dispatched',
  IN_TRANSIT = 'InTransit',
  RECEIVED = 'Received',
  CANCELLED = 'Cancelled',
}

@Entity({ name: 'stock_transfers' })
@Index(['organizationId', 'transferNumber'], { unique: true })
export class StockTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  transferNumber: string; // e.g. "ST-2025-000001"

  @Column({ type: 'date', nullable: false })
  transferDate: string;

  @Column({ type: 'uuid', nullable: false })
  fromWarehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fromWarehouseId' })
  fromWarehouse: Warehouse;

  @Column({ type: 'uuid', nullable: false })
  toWarehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'toWarehouseId' })
  toWarehouse: Warehouse;

  @Column({
    type: 'enum',
    enum: StockTransferStatus,
    default: StockTransferStatus.DRAFT,
  })
  status: StockTransferStatus;

  @Column({ type: 'date', nullable: true })
  dispatchDate: string;

  @Column({ type: 'date', nullable: true })
  receiveDate: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  trackingNumber: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedById: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  receivedById: string;

  @OneToMany(() => StockTransferItem, (item) => item.stockTransfer, { cascade: true })
  items: StockTransferItem[];

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
