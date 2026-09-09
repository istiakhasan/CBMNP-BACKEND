import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GarmentsPO } from './garmentsPo.entity';

@Entity('garments_po_items')
export class GarmentsPOItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  poId: string;

  @ManyToOne(() => GarmentsPO, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poId' })
  po: GarmentsPO;

  @Column({ default: 'fabric' })
  itemCategory: string; // 'fabric' | 'trims' | 'accessories' | 'packaging' | 'finished_goods' | 'others'

  @Column()
  itemName: string;

  @Column({ type: 'text', nullable: true })
  itemDetails: string;

  @Column({ nullable: true })
  itemColor: string;

  @Column({ default: 'Yds' })
  unit: string; // 'Yds' | 'Mtr' | 'Set' | 'Pcs' | 'Pair'

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  qty: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  receivedQty: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
