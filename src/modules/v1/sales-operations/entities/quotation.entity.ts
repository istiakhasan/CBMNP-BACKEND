import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Customers } from '../../customers/entities/customers.entity';
import { QuotationItem } from './quotation-item.entity';

export enum QuotationStatus {
  DRAFT = 'Draft',
  SENT = 'Sent',
  ACCEPTED = 'Accepted',
  CONVERTED = 'Converted', // Converted to sales order
  REJECTED = 'Rejected',
  EXPIRED = 'Expired',
}

@Entity({ name: 'quotations' })
@Index(['organizationId', 'quotationNumber'], { unique: true })
export class Quotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  quotationNumber: string; // e.g. "QT-2025-000001"

  @Column({ type: 'date', nullable: false })
  quotationDate: string;

  @Column({ type: 'date', nullable: false })
  expiryDate: string;

  @Column({ type: 'int', nullable: false })
  customerId: number;

  @ManyToOne(() => Customers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: Customers;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  subTotal: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  deliveryCharge: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    default: 0,
  })
  grandTotal: number;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    default: QuotationStatus.DRAFT,
  })
  status: QuotationStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  convertedOrderId: string; // ID of created Order

  @Column({ type: 'text', nullable: true })
  termsAndConditions: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

  @OneToMany(() => QuotationItem, (item) => item.quotation, { cascade: true })
  items: QuotationItem[];

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
