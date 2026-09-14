import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { GarmentsInventoryLot } from './garmentsInventoryLot.entity';
import { GarmentsInventoryAdjustment } from './garmentsAdjustment.entity';
import { GarmentsMaterialIssue } from './garmentsMaterialIssue.entity';

@Entity('garments_inventory')
export class GarmentsInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ default: 'fabric' })
  itemCategory: string; // 'fabric' | 'trims' | 'accessories' | 'packaging' | 'finished_goods' | 'others'

  @Index()
  @Column()
  itemName: string;

  @Column({ nullable: true })
  @Index()
  itemCode: string;

  @Column({ nullable: true })
  itemColor: string;

  @Column({ default: 'Yds' })
  unit: string; // 'Yds' | 'Mtr' | 'Set' | 'Pcs' | 'Pair'

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  bookingQty: number; // Total required from active BOMs / POs

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  receiveQty: number; // In-house received physical total

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  issueQty: number; // Total issued to production floor

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  stock: number; // Available in store = receiveQty - issueQty

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ nullable: true })
  organizationId: string;

  @OneToMany(() => GarmentsInventoryLot, (lot) => lot.inventory)
  lots: GarmentsInventoryLot[];

  @OneToMany(() => GarmentsInventoryAdjustment, (adj) => adj.inventory)
  adjustments: GarmentsInventoryAdjustment[];

  @OneToMany(() => GarmentsMaterialIssue, (issue) => issue.inventory)
  issues: GarmentsMaterialIssue[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
