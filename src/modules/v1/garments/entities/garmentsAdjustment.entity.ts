import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GarmentsInventory } from './garmentsInventory.entity';

@Entity('garments_inventory_adjustments')
export class GarmentsInventoryAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  inventoryId: string;

  @ManyToOne(() => GarmentsInventory, (inv) => inv.adjustments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventoryId' })
  inventory: GarmentsInventory;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantityDelta: number; // e.g. -50 for damage, +20 for surplus

  @Column()
  reason: string; // 'Damage', 'Shrinkage', 'Sample Cut', 'Physical Audit', 'Other'

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ default: 'pending' }) // 'pending' | 'approved' | 'rejected'
  status: string;

  @Column({ nullable: true })
  proposedBy: string;

  @Column({ nullable: true })
  decidedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt: Date;

  @Column({ type: 'text', nullable: true })
  decisionNote: string;

  @Column({ nullable: true })
  organizationId: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
