import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Procurement } from '../../procurement/entities/procurement.entity';

@Entity({ name: 'supplier' })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Basic company & contact details
  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  contactPerson: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  // Address info
  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  website: string;

  // Compliance & registration info
  @Column({ nullable: true })
  binNumber: string; // Business Identification Number

  @Column({ nullable: true })
  tinNumber: string; // Tax Identification Number

  @Column({ nullable: true })
  vatRegistrationNumber: string; // VAT registration ID

  @Column({ nullable: true })
  tradeLicenseNumber: string; // Local trade license

  // Banking & payment details
  @Column({ nullable: true })
  bankName: string;

  @Column({ nullable: true })
  bankAccountNumber: string;

  @Column({ nullable: true })
  paymentTerms: string; // e.g. "Net 30", "Advance Payment"

  // ERP internal fields
  @Column({ nullable: true })
  supplierCode: string; // Internal code for ERP

  @Column({ type: 'float', nullable: true })
  rating: number; // Supplier performance rating

  @Column({ type: 'text', nullable: true })
  notes: string; // Internal remarks

  // Organization link
  @Column({ nullable: true })
  organizationId: string;

  // Status flag
  @Column({ default: true })
  isActive: boolean; // soft-disable suppliers if needed

  // Relationships
  @OneToMany(() => Procurement, (item) => item.supplier, { cascade: true })
  procurements: Procurement[];

  // Timestamps
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
