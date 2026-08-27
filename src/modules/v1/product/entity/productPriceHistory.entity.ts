import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'product_price_history' })
export class ProductPriceHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oldRegularPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  newRegularPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oldSalePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  newSalePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oldPurchasePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  newPurchasePrice: number;

  @Column({ nullable: true })
  changedByUserId: string;

  @Column({ nullable: true, type: 'text' })
  note: string;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  changedAt: Date;
}
