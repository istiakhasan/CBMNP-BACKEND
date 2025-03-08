import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Procurement } from './procurement.entity';

@Entity()
export class ProcurementItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Procurement, (procurement) => procurement.items)
  procurement: Procurement;

  @Column()
  productId: string;

  @Column({ type: 'int' })
  orderedQuantity: number;

  @Column({ type: 'int' })
  receivedQuantity: number;

  @Column({ type: 'int' })
  damageQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPrice: number;
}
