import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Procurement } from './procurement.entity';
import { Product } from '../../product/entity/product.entity';

@Entity()
export class ProcurementItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Procurement, (procurement) => procurement.items)
  procurement: Procurement;

  @Column({nullable:true})
  productId: string;

  @ManyToOne(() => Product, (product) => product.procurementItems, { eager: true })
  @JoinColumn({ name: 'productId', referencedColumnName: 'id' })
  product: Product;
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
