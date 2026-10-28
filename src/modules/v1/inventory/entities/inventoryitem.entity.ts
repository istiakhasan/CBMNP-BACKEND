import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../product/entity/product.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Inventory } from './inventory.entity';

@Entity('inventoryItems')
export class InventoryItem {
  @PrimaryColumn()
  locationId: string;

  @PrimaryColumn()
  productId: string;

  @Column()
  inventoryId: string;

  @OneToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'locationId' })
  location: Warehouse;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0 })
  orderQue: number;

  @Column({ type: 'int', default: 0 })
  processing: number;

  @Column({ type: 'int', default: 0 })
  hoildQue: number;

  // Reservation for Pending orders. Do not merge this into orderQue: the
  // latter starts only when an order is Approved in the current workflow.
  @Column({ type: 'int', default: 0 })
  pendingReservedQuantity: number;

  @Column({ type: 'int', default: 0 })
  wastageQuantity: number;

  @Column({ type: 'int', default: 0 })
  expiredQuantity: number;

  @ManyToOne(() => Inventory, (inventory) => inventory.inventoryItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inventoryId' })
  inventory: Inventory;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
