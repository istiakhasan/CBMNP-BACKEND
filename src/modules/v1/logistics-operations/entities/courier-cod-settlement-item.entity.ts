import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CourierSettlement } from './courier-settlement.entity';
import { Order } from '../../order/entities/order.entity';

export enum CourierCodSettlementItemStatus { MATCHED = 'Matched', ADJUSTED_SETTLED = 'Adjusted Settled', ALREADY_SETTLED = 'Already Settled', UNRESOLVED = 'Unresolved' }
export enum CourierCodAdjustmentType { NEGOTIATED_DISCOUNT = 'Customer Negotiated Discount' }

@Entity({ name: 'courier_cod_settlement_items' })
@Index(['organizationId', 'orderId', 'trackingCode'], { unique: true })
export class CourierCodSettlementItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) @Index() settlementId: string;
  @ManyToOne(() => CourierSettlement, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'settlementId' }) settlement: CourierSettlement;
  @Column() @Index() orderId: number;
  @ManyToOne(() => Order, (order) => order.courierCodSettlementItems, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'orderId' }) order: Order;
  @Column({ type: 'uuid' }) @Index() organizationId: string;
  @Column() invoiceNumber: string;
  @Column() trackingCode: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) expectedCod: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) receivedCod: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true }) shippingCharge: number;
  @Column({ type: 'varchar', default: CourierCodSettlementItemStatus.MATCHED }) status: CourierCodSettlementItemStatus;
  @Column({ type: 'varchar', nullable: true }) adjustmentType: CourierCodAdjustmentType;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) adjustmentAmount: number;
  @Column({ type: 'text', nullable: true }) adjustmentReason: string;
  @Column({ nullable: true }) confirmedBy: string;
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' }) createdAt: Date;
}
