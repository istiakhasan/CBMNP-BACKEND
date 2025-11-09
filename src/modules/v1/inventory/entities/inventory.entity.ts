import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, ManyToMany, OneToOne, JoinColumn } from 'typeorm';
import { Product } from '../../product/entity/product.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { InventoryItem } from './inventoryitem.entity';

@Entity()
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @OneToOne(() => Product, (product) => product.inventories)
  @JoinColumn({name:'productId'})
  product: Product;
  @Column({ type: 'uuid', unique: true, nullable: true })
  productId: string;
  @OneToMany(() => Transaction, (transaction) => transaction.inventory)
  transactions: Transaction[];
  @OneToMany(() => InventoryItem, (product) => product.inventory, { cascade: true })
  inventoryItems: InventoryItem[];
  @Column({nullable:true})
  orderQue: number;
  @Column({nullable:true})
  hoildQue: number;
  @Column({nullable:true})
  processing: number;
  @Column({nullable:true})
  organizationId: string;
  @Column('int')
  stock: number;
  @Column('int',{nullable:true})
  wastageQuantity: number;
  @Column('int',{nullable:true})
  expiredQuantity: number;
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;
}

