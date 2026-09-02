import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../product/entity/product.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';

@Entity({ name: 'inventory_transaction' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid',nullable:true })
  productId: string;
  @Column({ type: 'uuid',nullable:true })
  inventoryId: string;
  @Column({nullable:true})
  locationId:string;
  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'locationId' })
  location: Warehouse;
  @Column('int')
  quantity: number;
  @Column({ nullable: true})
  organizationId: string;
  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column()
  type: 'IN' | 'OUT';

  @Column({ nullable: true })
  referenceType: string; // e.g. 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER_OUT', 'STOCK_TRANSFER_IN', 'ORDER_DISPATCH', 'ORDER_RETURN', 'PURCHASE_RECEIPT', 'PURCHASE_RETURN'

  @Column({ nullable: true })
  referenceNumber: string; // e.g. Order #, Transfer #, Adjustment #, GRN #

  @Column({ type: 'text', nullable: true })
  remarks: string; // Detailed human-readable explanation

  @Column({ nullable: true })
  performedById: string;

  @Column({ nullable: true })
  performedByName: string;

  @CreateDateColumn()
  transactionDate: Date;

  @ManyToOne(() => Product, (product) => product.transactions)
  product: Product;

  @ManyToOne(() => Inventory, (inventory) => inventory.transactions)
  @JoinColumn({ name: 'inventoryId', referencedColumnName: 'productId' })
  inventory: Inventory;
}
