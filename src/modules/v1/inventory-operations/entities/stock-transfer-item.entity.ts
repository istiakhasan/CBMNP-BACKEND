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
import { StockTransfer } from './stock-transfer.entity';
import { Product } from '../../product/entity/product.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'stock_transfer_items' })
export class StockTransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  stockTransferId: string;

  @ManyToOne(() => StockTransfer, (st) => st.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stockTransferId' })
  stockTransfer: StockTransfer;

  @Column({ type: 'uuid', nullable: false })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', nullable: false })
  requestedQuantity: number;

  @Column({ type: 'int', default: 0 })
  dispatchedQuantity: number;

  @Column({ type: 'int', default: 0 })
  receivedQuantity: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchNumber: string;

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
