import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customers } from './customers.entity';

@Entity({ name: 'address_book' })
export class AddressBook {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, type: 'varchar' })
  label: string; // e.g. Home, Office, Warehouse

  @Column({ nullable: true, type: 'varchar' })
  receiverName: string;

  @Column({ nullable: true, type: 'varchar' })
  receiverPhoneNumber: string;

  @Column({ nullable: true, type: 'varchar' })
  division: string;

  @Column({ nullable: true, type: 'varchar' })
  district: string;

  @Column({ nullable: true, type: 'varchar' })
  thana: string;

  @Column({ nullable: true, type: 'varchar' })
  address: string;

  @Column({ default: false })
  isDefault: boolean; // mark as primary address
  @Column({ nullable: true })
  relationship: string; // for Probashi case
  @ManyToOne(() => Customers, (customer) => customer.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customers;

  @Column()
  customerId: number;

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
