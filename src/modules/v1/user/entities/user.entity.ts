import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserPermission } from '../../userpermission/entities/userpermission.entity';
export enum UserRole {
  ADMIN = 'admin',
  CTGADMIN = 'ctgadmin',
  HR = 'hr',
  AGENT = 'agent',
  USER = 'user',
  COS = 'cos',
  warehouse_manager = 'warehouse_manager',
  operation_manager = 'operation_manager',
  cs_agent = 'cs_agent',
  media_manager = 'media_manager',
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
  @Column({ nullable: false, type: 'varchar' })
  password: string;
  @Column({ nullable: true, type: 'boolean',default:true })
  active: boolean;
  @OneToMany(() => UserPermission, (userPermission) => userPermission.user)
  userPermissions: UserPermission[];
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
