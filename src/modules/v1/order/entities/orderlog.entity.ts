import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Users } from '../../user/entities/user.entity';

@Entity({ name: 'orders_log' })
export class OrdersLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ nullable: true })
  orderId: number;
  @Column({ nullable: true })
  action: string; // e.g., 'CREATE', 'UPDATE', 'DELETE'
  @Column({ nullable: true })
  changedField: string; // e.g., 'status', 'products', 'totalPrice'
  @Column({ nullable: true, type: 'text' })
  previousValue: string; // Store previous value
  @Column({ nullable: true, type: 'text' })
  agentId: string; // Store previous value
  @ManyToOne(() => Users, (user) => user.logs, { nullable: true })
  @JoinColumn({name:'agentId',referencedColumnName:'userId'})
  updatedBy: Users;
  @Column({ nullable: true, type: 'text' })
  newValue: string; // Store new value
  @ManyToOne(() => Order, (order) => order.orderLogs)
  @JoinColumn({ name: 'orderId', referencedColumnName: 'id' })
  order:Order
  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt: Date;
  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
