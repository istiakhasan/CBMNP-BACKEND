import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../product/entity/product.entity';


@Entity({ name: 'order_product_returns' })
export class OrderProductReturn {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orderId: number;

  @Column({type:'uuid'})
  productId: string; 

  @Column({ type: 'int', default: 0 })
  returnQuantity: number;

  @Column({ type: 'int', default: 0 })
  damageQuantity: number;

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @Column({ nullable: true, type: 'text' })
  remarks: string;

  @Column({ type: 'timestamp', nullable: true })
  returnDate: Date;

  @ManyToOne(() => Order, (order) => order.productReturns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Product, (product) => product.returns, { onDelete: 'CASCADE' })
//   @JoinColumn({ name: 'productId',referencedColumnName:'productId' })
  product: Product;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
