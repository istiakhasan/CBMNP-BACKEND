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
  shippingCharge: string;
  @Column({ nullable: true })
  orderSource: string;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  productValue: string;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;
  @Column({ nullable: true })
  currier: string;
  @OneToMany(() => Products, (product) => product.order, { cascade: true })
  products: Products[];

  @ManyToOne(() => Customers, (customer) => customer.orders, { eager: true })
  @JoinColumn({ name: 'customerId' ,referencedColumnName: 'customer_Id'}) 
  customer: Customers;
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
