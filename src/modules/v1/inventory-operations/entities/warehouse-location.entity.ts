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
import { Warehouse } from '../../warehouse/entities/warehouse.entity';

@Entity({ name: 'warehouse_locations' })
@Index(['warehouseId', 'locationCode'], { unique: true })
export class WarehouseLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'varchar', length: 50, nullable: false })
  locationCode: string; // e.g. "Aisle-1-Rack-2-Shelf-3" or "BIN-A01"

  @Column({ type: 'varchar', length: 50, nullable: true })
  aisle: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  rack: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  shelf: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bin: string;

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
