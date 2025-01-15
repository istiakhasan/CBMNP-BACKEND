import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';


@Entity({ name: 'order_status' })
export class OrderStatus {
  @PrimaryGeneratedColumn()
  value: number;
  @Column({ nullable: false, type: 'varchar' })
  label: string;

  @OneToMany(() => Order, (order) => order.status)
  orders: Order[];

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  public createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  public updatedAt: Date;
}
