import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany, OneToOne, JoinColumn } from 'typeorm';
import { Product } from '../../product/entity/product.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { InventoryItem } from './inventoryitem.entity';


@Entity()
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Product, (product) => product.inventories)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'uuid', unique: true, nullable: true })
  productId: string;

  @OneToMany(() => Transaction, (transaction) => transaction.inventory)
  transactions: Transaction[];

  @OneToMany(() => InventoryItem, (product) => product.inventory, {
    cascade: true,
  })
  inventoryItems: InventoryItem[];

  @Column({ type: 'int', default: 0 })
  orderQue: number;

  @Column({ type: 'int', default: 0 })
  hoildQue: number;

  @Column({ type: 'int', default: 0 })
  processing: number;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'int', default: 0 })
  wastageQuantity: number;

  @Column({ type: 'int', default: 0 })
  expiredQuantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
