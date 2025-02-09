import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UserPermission } from '../../userpermission/entities/userpermission.entity';
import { Order } from '../../order/entities/order.entity';
import { Comments } from '../../Comments/entities/orderComment.entity';
import { OrdersLog } from '../../order/entities/orderlog.entity';
import { PaymentHistory } from '../../order/entities/paymentHistory.entity';
import { Organization } from '../../organization/entities/organization.entity';
export enum UserRole {
  ADMIN = 'admin',
  User = 'user',
}

@Entity({ name: 'users' })
export class Users {
  @PrimaryGeneratedColumn('increment')
  id: number;
  @Column({ nullable: false, type: 'varchar' })
  name: string;
  @Column({ nullable: false, type: 'enum', enum: UserRole })
  role: UserRole;
  @Column({ nullable: false, type: 'varchar', unique: true })
  userId: string;
  @Column({ nullable: false, type: 'varchar',unique:true })
  phone: string;
  @Column({ nullable: false, type: 'varchar',unique:true })
  email: string;
  @Column({ nullable: true, type: 'text' })
  address: string;
  @Column({ nullable: false, type: 'varchar'})
  password: string;
  @Column({ nullable: true})
  organizationId: string;
  @Column({ nullable: true, type: 'boolean',default:true })
  active: boolean;
  @OneToMany(() => UserPermission, (userPermission) => userPermission.user)
  userPermissions: UserPermission[];
  @OneToMany(() => Order, (Order) => Order.agent)
  orders: Order[];
  @OneToMany(() => Comments, (comment) => comment.user)
  comments: Comments[];
  @OneToMany(() => OrdersLog, (orderLog) =>orderLog.updatedBy )
  logs: OrdersLog[];
  @OneToMany(() => PaymentHistory, (orderLog) =>orderLog.user )
  paymentHistory: PaymentHistory[];

  @ManyToOne(() => Organization, (organization) => organization.users)
  @JoinColumn({ name: 'organizationId' }) // This makes Users the owner of the relationship
  organization: Organization;
  
  
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
