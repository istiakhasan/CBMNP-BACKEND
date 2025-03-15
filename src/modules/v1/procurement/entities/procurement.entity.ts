import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { ProcurementItem } from './procurementItem.entity';


@Entity()
export class Procurement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.procurements, { eager: true })
  supplier: Supplier;

  @OneToMany(() => ProcurementItem, (item) => item.procurement, { cascade: true })
  items: ProcurementItem[];

  @Column({ default: false })
  billGenerated: boolean;

  @Column({ nullable: true })
  billAmount: number;

  @Column({ nullable: true })
  invoiceNumber: string;

  @Column({nullable:true})
  receivedBy: string;

  @Column({ type: 'enum', enum: ['Pending', 'Processing','Approved', 'Completed', 'Cancelled'], default: 'Pending' })
  status: string;

  @Column({ nullable: true })
  notes: string;
  @Column({ nullable: true })
  organizationId: string;

   @Index()
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
