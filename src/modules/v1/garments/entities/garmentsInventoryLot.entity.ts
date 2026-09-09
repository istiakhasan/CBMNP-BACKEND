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
import { GarmentsInventory } from './garmentsInventory.entity';
import { GarmentsPO } from './garmentsPo.entity';

@Entity('garments_inventory_lots')
export class GarmentsInventoryLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  inventoryId: string;

  @ManyToOne(() => GarmentsInventory, (inv) => inv.lots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventoryId' })
  inventory: GarmentsInventory;

  @Column({ nullable: true })
  poId: string;

  @ManyToOne(() => GarmentsPO, (po) => po.lots, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'poId' })
  po: GarmentsPO;

  @Index()
  @Column()
  lotNumber: string; // e.g. LOT-2026-A1

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'date', nullable: true })
  inHouseDate: string;

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  receivedQty: number;

  @Column({ type: 'decimal', precision: 14, scale: 3, default: 0 })
  remainingQty: number;

  @Column({ nullable: true })
  locationRack: string;

  @Column({ nullable: true })
  shadeRollNumber: string;

  @Column({ nullable: true })
  qcRemarks: string;

  @Column({ default: 'pending' })
  approvalStatus: string; // 'pending' | 'approved' | 'rejected'

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  approvalNote: string;

  @Column({ nullable: true })
  sourceType: string;

  @Column({ nullable: true })
  orderNo: string;

  @Column({ nullable: true })
  supplierOrMarket: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
