// import { Order } from 'src/modules/order/entities/order.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';

export enum CustomerType {
  Probashi = 'PROBASHI',
  NonProbashi = 'NON_PROBASHI',
}

@Entity({ name: 'customers' })
export class Customers {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, type: 'varchar' })
  customerName: string;

  @Column({ nullable: true, type: 'varchar' })
  customerPhoneNumber: string;

  @Column({ nullable: true, type: 'varchar' })
  customerAdditionalPhoneNumber: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true, type: 'varchar' })
  division: string;

  @Column({ nullable: true, type: 'varchar' })
  district: string;

  @Column({ type: 'varchar', nullable: true })
  thana: string;

  @Column({ enum: CustomerType, type: 'enum' })
  customerType: CustomerType;

  @Column({ nullable: true, type: 'varchar' })
  country: string;

  @Column({ nullable: false, unique: true, type: 'varchar' })
  customer_Id: string; 

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  public created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  public updated_at: Date;
}
