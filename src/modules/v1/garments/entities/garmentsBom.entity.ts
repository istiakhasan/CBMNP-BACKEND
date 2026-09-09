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
import { GarmentsBOMItem } from './garmentsBomItem.entity';

@Entity('garments_boms')
export class GarmentsBOM {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  orderId: string;

  @ManyToOne(() => GarmentsBuyerOrder, (order) => order.boms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: GarmentsBuyerOrder;

  @Index()
  @Column()
  styleNo: string; // e.g. STY-9021

  @Column()
  styleName: string; // e.g. Men's Cotton Polo

  @Column({ type: 'int', default: 0 })
  orderQuantity: number; // Garment order pieces

  @Column({ default: 'draft' }) // 'draft' | 'approved'
  status: string;

  @Column({ nullable: true })
  organizationId: string;

  @OneToMany(() => GarmentsBOMItem, (item) => item.bom, { cascade: true })
  items: GarmentsBOMItem[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
