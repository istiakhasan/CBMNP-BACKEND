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
import { SupplierQuotation } from './supplier-quotation.entity';

export enum RFQStatus {
  DRAFT = 'Draft',
  SENT = 'Sent',
  CLOSED = 'Closed',
  AWARDED = 'Awarded',
}

@Entity({ name: 'rfqs' })
@Index(['organizationId', 'rfqNumber'], { unique: true })
export class RFQ {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  rfqNumber: string; // e.g. "RFQ-2025-000001"

  @Column({ type: 'varchar', length: 255, nullable: false })
  title: string;

  @Column({ type: 'date', nullable: false })
  issueDate: string;

  @Column({ type: 'date', nullable: false })
  deadlineDate: string;

  @Column({
    type: 'enum',
    enum: RFQStatus,
    default: RFQStatus.DRAFT,
  })
  status: RFQStatus;

  @Column({ type: 'jsonb', nullable: true })
  requestedItems: Array<{ productId: string; quantity: number; targetPrice?: number }>;

  @Column({ type: 'text', nullable: true })
  termsAndConditions: string;

  @OneToMany(() => SupplierQuotation, (sq) => sq.rfq, { cascade: true })
  quotations: SupplierQuotation[];

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
