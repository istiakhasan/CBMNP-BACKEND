import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';

@Entity({ name: 'delivery_partner' })
@Unique(['organizationId', 'partnerName']) 
export class DeliveryPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ nullable: true })
  contactPerson: string;
  @Column({ nullable: true })
  locationId: string;
  @Column({ nullable: true })
  organizationId: string;
  @Column({ nullable: true })
  phone: string;
  @Column({ type: 'boolean', nullable: true })
  active: boolean;
  @Column({ nullable: true })
  secret_key: string;
  @Column({ nullable: true })
  api_key: string;
  @Column({ nullable: true })
  partnerName: string;
  @OneToMany(() => Order, (requisition) =>requisition.partner )
  orders: Order[];
  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  public createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  public updatedAt: Date;
}
