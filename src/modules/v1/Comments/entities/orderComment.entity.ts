import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { Users } from '../../user/entities/user.entity';


@Entity({ name: 'order_comment' })
export class Comments {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  comment: string;
  @Column()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.comments)
  order: Order;

  @Column({nullable:true})
  userId: string;
  @JoinColumn({ name: 'userId' ,referencedColumnName: 'userId'}) 
  @ManyToOne(() => Users, (user) => user.comments)
  user: Users;

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
