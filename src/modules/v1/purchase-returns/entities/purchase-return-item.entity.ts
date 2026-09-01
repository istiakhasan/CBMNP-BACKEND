import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PurchaseReturn } from './purchase-return.entity';
import { Product } from '../../product/entity/product.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'purchase_return_items' })
export class PurchaseReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  purchaseReturnId: string;

  @ManyToOne(() => PurchaseReturn, (pr) => pr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseReturnId' })
  purchaseReturn: PurchaseReturn;

  @Column({ type: 'uuid', nullable: false })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', nullable: false })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  unitPrice: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  totalPrice: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  returnReason: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
