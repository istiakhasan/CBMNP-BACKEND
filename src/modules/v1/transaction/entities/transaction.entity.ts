import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../product/entity/product.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity({ name: 'inventory_transaction' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid',nullable:true })
  productId: string;
  @Column({ type: 'uuid',nullable:true })
  inventoryId: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column()
  type: 'IN' | 'OUT';

  @CreateDateColumn()
  transactionDate: Date;

  @ManyToOne(() => Product, (product) => product.transactions)
  product: Product;

  @ManyToOne(() => Inventory, (inventory) => inventory.transactions)
  @JoinColumn({name:"inventoryId",referencedColumnName:"productId"})
  inventory: Inventory;
}
