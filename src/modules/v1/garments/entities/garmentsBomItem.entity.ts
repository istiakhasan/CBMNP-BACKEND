import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GarmentsBOM } from './garmentsBom.entity';

@Entity('garments_bom_items')
export class GarmentsBOMItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bomId: string;

  @ManyToOne(() => GarmentsBOM, (bom) => bom.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bomId' })
  bom: GarmentsBOM;

  @Column({ default: 'fabric' })
  itemCategory: string; // 'fabric' | 'trims' | 'accessories' | 'packaging' | 'finished_goods' | 'others'

  @Column()
  itemName: string;

  @Column({ nullable: true })
  itemColor: string;

  @Column({ default: 'Yds' })
  unit: string; // 'Yds' | 'Mtr' | 'Set' | 'Pcs' | 'Pair'

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  consumption: number; // Consumption per garment pc

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  wastagePercent: number; // e.g. 5%

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  totalQty: number; // orderQuantity * consumption * (1 + wastage/100)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  itemPrice: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalCost: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
