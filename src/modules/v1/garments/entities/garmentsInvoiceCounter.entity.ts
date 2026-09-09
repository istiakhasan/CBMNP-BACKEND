import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('garments_invoice_counters')
export class GarmentsInvoiceCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 1000 })
  lastOrderNumber: number;

  @Column({ default: 1000 })
  lastPoNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
