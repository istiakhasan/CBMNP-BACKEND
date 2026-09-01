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
import { RFQ } from './rfq.entity';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'supplier_quotations' })
@Index(['organizationId', 'quotationNumber'], { unique: true })
export class SupplierQuotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  quotationNumber: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  rfqId: string;

  @ManyToOne(() => RFQ, (r) => r.quotations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfqId' })
  rfq: RFQ;

  @Column({ type: 'uuid', nullable: false })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  quotedAmount: number;

  @Column({ type: 'int', default: 7 })
  leadTimeDays: number;

  @Column({ type: 'jsonb', nullable: true })
  itemsQuoted: Array<{ productId: string; unitPrice: number; quantity: number }>;

  @Column({ type: 'boolean', default: false })
  isAwarded: boolean;

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
