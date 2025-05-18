import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Products } from './products.entity';
import { Customers } from '../../customers/entities/customers.entity';
import { OrderStatus } from '../../status/entities/status.entity';
import { Users } from '../../user/entities/user.entity';
import { PaymentHistory } from './paymentHistory.entity';
import { Comments } from '../../Comments/entities/orderComment.entity';
import { OrdersLog } from './orderlog.entity';
import { Requisition } from '../../requsition/entities/requsition.entity';

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ unique: true, nullable: true })
  orderNumber: string;
  @Column({ nullable: true, type: 'varchar' })
  customerId: string;
  @Column({ nullable: true })
  receiverPhoneNumber: string;
  @Column({ nullable: true })
  receiverName: string;
  @Column({ nullable: true })
  organizationId: string;
  @Column({ nullable: true })
  deliveryNote: string;
  @Column({ nullable: true })
  shippingCharge: number;
  @Column({ nullable: true })
  shippingType: string;
  @Column({ nullable: true })
  orderType: string;
  @Column({ nullable: true })
  invoiceNumber: string;
  @Column({ nullable: true })
  orderSource: string;
  @Column({ nullable: true })
  productValue: number;
  @Column({ nullable: true })
  totalPrice: number;
  @Column({ nullable: true })
  discount: number;
  @Column({ nullable: true })
  totalPaidAmount: number;
  @Column({ nullable: true })
  totalReceiveAbleAmount: number;
  @Column({ nullable: true })
  currier: string;
  @Column({ nullable: true })
  paymentStatus: string;
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
  @Column({ nullable: true })
  onHoldReason: string;
  @Column({ nullable: true })
  onCancelReason: string;
  @Column({ nullable: true })
  locationId: string;
  @Column({ nullable: true })
  requisitionId: string;
  @Column({ nullable: true })
  previousStatus: string;
  // store status change time 
  // store status change time 
  // store status change time 
  // store status change time 
  // store status change time 
  @Column({ type: 'timestamp', nullable: true })
  intransitTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  approvedTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  packingTime: Date;
  @Column({ type: 'timestamp', nullable: true })
  storeTime: Date;

  @OneToMany(() => Products, (product) => product.order, { cascade: true })
  products: Products[];

  @ManyToOne(() => Customers, (customer) => customer.orders, { eager: true })
  @JoinColumn({ name: 'customerId', referencedColumnName: 'customer_Id' })
  customer: Customers;

  // relation with req
  @ManyToOne(() => Requisition, (requisition) => requisition.orders)
  requisition: Requisition;

  @Index()
  @Column({ nullable: true })
  statusId: number;
  @ManyToOne(() => OrderStatus, (status) => status.orders, { eager: true })
  @JoinColumn({ name: 'statusId', referencedColumnName: 'value' })
  status: OrderStatus;

  @Column({ nullable: true })
  agentId: string;
  @ManyToOne(() => Users, (status) => status.orders, { eager: true })
  @JoinColumn({ name: 'agentId', referencedColumnName: 'userId' })
  agent: Users;

  @OneToMany(() => PaymentHistory, (paymentHistory) => paymentHistory.order, {
    cascade: true,
  })
  paymentHistory: PaymentHistory[];
  @OneToMany(() => Comments, (comment) => comment.order, { cascade: true })
  comments: Comments[];
  @OneToMany(() => OrdersLog, (logs) => logs.order)
  orderLogs: OrdersLog[];

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
