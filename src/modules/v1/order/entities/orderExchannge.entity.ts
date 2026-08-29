// order_exchange.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity({ name: 'order_exchanges' })
export class OrderExchange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  originalOrderId: number; // পুরনো order (যেখান থেকে return হলো)

  @Column()
  newOrderId: number; // নতুন order (যেটাতে নতুন product গেলো)

  @Column()
  oldProductId: string;

  @Column({ type: 'int' })
  oldQuantity: number;

  @Column()
  newProductId: string;

  @Column({ type: 'int' })
  newQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceDifference: number; // শুধু তথ্যের জন্য — নতুন order-এর payment ঠিক করবে

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @Column({ nullable: true })
  agentId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'originalOrderId' })
  originalOrder: Order;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'newOrderId' })
  newOrder: Order;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}