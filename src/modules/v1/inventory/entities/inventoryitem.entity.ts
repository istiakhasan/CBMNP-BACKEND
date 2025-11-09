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

  @Column()
  quantity: number;
  @Column({nullable:true})
  orderQue: number;
  @Column({nullable:true})
  processing: number;
  @Column({nullable:true})
  hoildQue: number;
  @Column({ default: 0 })
  wastageQuantity: number;

  @Column({ default: 0 })
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
