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
  Unique,
} from 'typeorm';
import { UserPermission } from '../../userpermission/entities/userpermission.entity';
import { Order } from '../../order/entities/order.entity';
import { Comments } from '../../Comments/entities/orderComment.entity';
import { OrdersLog } from '../../order/entities/orderlog.entity';
import { PaymentHistory } from '../../order/entities/paymentHistory.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Requisition } from '../../requsition/entities/requsition.entity';
import { Procurement } from '../../procurement/entities/procurement.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  OWNER = 'owner',
  SUPER = 'super_admin',
}

@Entity({ name: 'users' })
@Unique(['email', 'organizationId'])
export class Users {
  @ApiProperty({ example: 1, description: 'Auto-incremented user ID' })
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @Column({ nullable: false, type: 'varchar' })
  name: string;

  @ApiProperty({ example: UserRole.ADMIN, enum: UserRole, description: 'Role of the user' })
  @Column({ nullable: false, type: 'enum', enum: UserRole })
  role: UserRole;

  @ApiProperty({ example: 'USR12345', description: 'Unique user identifier' })
  @Column({ nullable: false, type: 'varchar', unique: true })
  userId: string;

  @ApiProperty({ example: 'EMP-001', description: 'Internal employee ID', required: false })
  @Column({ nullable: true, type: 'varchar' })
  internalId: string;

  @ApiProperty({ example: '+8801712345678', description: 'Phone number of the user' })
  @Column({ nullable: false, type: 'varchar' })
  phone: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @Column({ nullable: false, type: 'varchar' })
  email: string;

  @ApiProperty({ example: 'Dhaka, Bangladesh', description: 'User address', required: false })
  @Column({ nullable: true, type: 'text' })
  address: string;

  @ApiProperty({ example: 'hashed_password_here', description: 'Password (hashed)' })
  @Column({ nullable: false, type: 'varchar' })
  password: string;

  @ApiProperty({ example: 'a3f83a7a-1c2d-4b6e-8eaa-9f02f64c52df', description: 'Organization ID' })
  @Column({ nullable: true })
  organizationId: string;

  @ApiProperty({ example: true, description: 'Is the user active?' })
  @Column({ nullable: true, type: 'boolean', default: true })
  active: boolean;

  @ManyToOne(() => Organization, (organization) => organization.users)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => UserPermission, (userPermission) => userPermission.user)
  userPermissions: UserPermission[];

  @OneToMany(() => Order, (order) => order.agent)
  orders: Order[];

  @OneToMany(() => Comments, (comment) => comment.user)
  comments: Comments[];

  @OneToMany(() => OrdersLog, (orderLog) => orderLog.updatedBy)
  logs: OrdersLog[];

  @OneToMany(() => PaymentHistory, (orderLog) => orderLog.user)
  paymentHistory: PaymentHistory[];

  @OneToMany(() => Requisition, (requisition) => requisition.user)
  requisition: Requisition[];

  @OneToMany(() => Procurement, (procurement) => procurement.createdBy)
  procurements: Procurement[];

  @ApiProperty({ example: '2025-09-03T12:00:00Z', description: 'User creation timestamp' })
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  public createdAt: Date;

  @ApiProperty({ example: '2025-09-03T12:30:00Z', description: 'Last updated timestamp' })
  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  public updatedAt: Date;
}
