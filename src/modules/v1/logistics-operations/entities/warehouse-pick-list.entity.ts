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
import { PickListItem } from './pick-list-item.entity';

export enum PickListStatus {
  GENERATED = 'Generated',
  IN_PROGRESS = 'InProgress',
  COMPLETED = 'Completed',
}

@Entity({ name: 'warehouse_pick_lists' })
@Index(['organizationId', 'pickListNumber'], { unique: true })
export class WarehousePickList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  pickListNumber: string; // e.g. "PL-2025-000001"

  @Column({ type: 'date', nullable: false })
  pickDate: string;

  @Column({ type: 'uuid', nullable: false })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'jsonb', nullable: false })
  orderIds: string[]; // List of Order IDs aggregated into this pick list

  @Column({
    type: 'enum',
    enum: PickListStatus,
    default: PickListStatus.GENERATED,
  })
  status: PickListStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assignedPickerId: string;

  @OneToMany(() => PickListItem, (item) => item.pickList, { cascade: true })
  items: PickListItem[];

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
