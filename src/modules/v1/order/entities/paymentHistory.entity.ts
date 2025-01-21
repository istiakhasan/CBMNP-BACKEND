import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
  } from 'typeorm';
  import { Order } from './order.entity';
  
  @Entity({ name: 'payment_history' })
  export class PaymentHistory {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ nullable: false })
    paymentMethod: string; // E.g., 'Credit Card', 'PayPal', etc.
  
    @Column({ nullable: false, type: 'decimal', precision: 10, scale: 2 })
    paidAmount: number; 
  
    @Column({ nullable: true, type: 'text' })
    transactionId: string; //exist
  
    @Column({ nullable: true })
    paymentStatus: string; // E.g., 'Paid', 'Pending', etc.
  
    @ManyToOne(() => Order, (order) => order.paymentHistory, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderId' })
    order: Order;
  
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
  