import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { Users } from '../../user/entities/user.entity';

@Entity('requisitions')
export class Requisition {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ unique: true })
  requisitionNumber: string;
  @Column({nullable:true})
  userId: string;
  @Column({nullable:true})
  organizationId: string;
  @Column({nullable:true})
  totalOrders: number;
  @Column('int', { array: true, nullable: true }) // Define the array type for PostgreSQL
  orderIds: number[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  dateCreated: Date;

  @OneToMany(() => Order, (order) => order.requisition, { cascade: true })
  orders: Order[];

  // @Column({ nullable: true })
  // agentId: string;
  @ManyToOne(() => Users, (status) => status.orders)
  @JoinColumn({ name: 'userId' ,referencedColumnName: 'userId'}) 
  user: Users;

  @Index()
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
