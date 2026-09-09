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
import { GarmentsBuyerOrder } from './garmentsBuyerOrder.entity';
import { GarmentsPOItem } from './garmentsPoItem.entity';
import { GarmentsInventoryLot } from './garmentsInventoryLot.entity';

@Entity('garments_pos')
export class GarmentsPO {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  supplierPoNo: string; // e.g. PO-2026-0001

  @Column({ nullable: true })
  orderId: string;

  @ManyToOne(() => GarmentsBuyerOrder, (order) => order.pos, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order: GarmentsBuyerOrder;

  @Column({ type: 'date', nullable: true })
  poDate: string;

  @Column()
  supplierName: string;

  @Column({ type: 'text', nullable: true })
  supplierDetails: string;

  @Column({ nullable: true })
  shipToName: string;

  @Column({ nullable: true })
  shipToCompany: string;

  @Column({ type: 'text', nullable: true })
  shipToAddress: string;

  @Column({ nullable: true })
  shippingTerms: string;

  @Column({ nullable: true })
  shippingMethod: string;

  @Column({ type: 'date', nullable: true })
  deliveryDate: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ default: 'draft' })
  // 'draft' | 'pending_check' | 'pending_approval' | 'approved' | 'rejected'
  status: string;

  @Column({ nullable: true })
  rejectedAtStage: string; // 'check' | 'approval'

  @Column({ type: 'text', nullable: true })
  rejectionNote: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  taxRatePercent: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  otherCharges: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount: number;

  // Audit info
  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  submittedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ nullable: true })
  checkedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  checkedAt: Date;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  rejectedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @Column({ nullable: true })
  organizationId: string;

  @OneToMany(() => GarmentsPOItem, (item) => item.po, { cascade: true })
  items: GarmentsPOItem[];

  @OneToMany(() => GarmentsInventoryLot, (lot) => lot.po)
  lots: GarmentsInventoryLot[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
