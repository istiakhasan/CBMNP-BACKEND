import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('shopify_inventory_sync_outbox')
export class ShopifyInventorySyncOutbox {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() productId: string;
  @Column() warehouseId: string;
  @Column() organizationId: string;
  @Column({ type: 'int', nullable: true }) quantity: number;
  @Column({ default: 'PENDING' }) status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'text', nullable: true }) lastError: string;
  @Column({ type: 'timestamp', nullable: true }) nextRetryAt: Date;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
