import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Products } from './products.entity';
import { Customers } from '../../customers/entities/customers.entity';
import { OrderStatus } from '../../status/entities/status.entity';
import { Users } from '../../user/entities/user.entity';
import { PaymentHistory } from './paymentHistory.entity';


@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ unique: true, nullable: true })
  orderNumber: string;
  @Column({ nullable: true,type:'varchar' })
  customerId: string;
  @Column({ nullable: true })
  receiverPhoneNumber: string;
  @Column({ nullable: true })
  receiverName: string;
  @Column({ nullable: true })
  deliveryNote: string;
  @Column({ nullable: true })
  shippingCharge: string;
  @Column({ nullable: true })
  shippingType: string;
  @Column({ nullable: true })
  orderType: string;
  @Column({ nullable: true })
  orderSource: string;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  productValue: string;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;
  @Column({ nullable: true })
  currier: string;
  @Column({ nullable: true })
  paymentMethod: string;
  @Column({ nullable: true })
  deliveryDate: string;
  // receiver address
  @Column({ nullable: true })
  receiverDivision: string;
  @Column({ nullable: true })
  receiverDistrict: string;
  @Column({ nullable: true })
  receiverThana: string;
  @Column({ nullable: true })
  receiverAddress: string;
 
  @OneToMany(() => Products, (product) => product.order, { cascade: true })
  products: Products[];

  @ManyToOne(() => Customers, (customer) => customer.orders, { eager: true })
  @JoinColumn({ name: 'customerId' ,referencedColumnName: 'customer_Id'}) 
  customer: Customers;

  @Column({ nullable: true })
  statusId: number;
  @ManyToOne(() => OrderStatus, (status) => status.orders, { eager: true })
  @JoinColumn({ name: 'statusId' ,referencedColumnName: 'value'}) 
  status: OrderStatus;


  @Column({ nullable: true })
  agentId: string;
  @ManyToOne(() => Users, (status) => status.orders, { eager: true })
  @JoinColumn({ name: 'agentId' ,referencedColumnName: 'userId'}) 
  agent: Users;

  @OneToMany(() => PaymentHistory, (paymentHistory) => paymentHistory.order, { cascade: true })
  paymentHistory: PaymentHistory[];
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
