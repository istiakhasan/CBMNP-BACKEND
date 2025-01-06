import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany, OneToOne, JoinColumn } from 'typeorm';
import { Product } from '../../product/entity/product.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';

@Entity()
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Product, (product) => product.inventories)
  @JoinColumn()
  product: Product;

  @Column({ type: 'uuid', unique: true, nullable: true })
  productId: string;

  @OneToMany(() => Transaction, (transaction) => transaction.inventory)
  transactions: Transaction[];

  @Column('int')
  stock: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

