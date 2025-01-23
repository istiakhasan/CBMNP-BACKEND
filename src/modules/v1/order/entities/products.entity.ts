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

  
  @Entity({ name: 'products' })
  export class Products {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column()
    productId: string;
    @Column()
    orderId: number;
  
    @Column({ type: 'int' })
    productQuantity: number;
  
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    productPrice: number;
  
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    subtotal: number;
  
    @ManyToOne(() => Product, (product) => product.products, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'productId' })
    product: Product;
  
    @ManyToOne(() => Order, (order) => order.products, { onDelete: 'CASCADE' })
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
  