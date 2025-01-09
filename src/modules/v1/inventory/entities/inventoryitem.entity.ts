import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Product } from '../../product/entity/product.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Inventory } from './inventory.entity';

@Entity('inventoryItems')
@Unique(['locationId', 'productId']) 
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  locationId: string; 

  @Column()
  productId: string; 

  @OneToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'locationId' })
  location: Warehouse;

  @Column()
  quantity: number;

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
