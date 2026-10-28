import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';

@Entity({ name: 'warehouse' })
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ nullable: true, unique: true })
  name: string;
  @Column({ nullable: true })
  location: string;
  @Column({ nullable: true })
  contactPerson: string;
  @Column({ nullable: true })
  phone: string;
  @Column({ nullable: true })
  organizationId: string;
  // Shopify Location GID assigned to this ERP warehouse. A null value means
  // this warehouse is deliberately not published to Shopify.
  @Column({ nullable: true })
  shopifyLocationId: string;
  @OneToMany(() => Order, (order) => order.warehouse)
  orders: Order[];
@Column({ type: 'boolean', default: false })
isDefault: boolean;
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
