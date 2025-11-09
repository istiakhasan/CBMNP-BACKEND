import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserPermission } from '../../userpermission/entities/userpermission.entity';

@Entity({ name: 'permission' })
export class Permission {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({  type: 'varchar' })
  label: string;
  @Column({ nullable: true, type: 'varchar' })
  base: string;
  @OneToMany(
    () => UserPermission,
    (userPermission) => userPermission.permission,
  )
  userPermissions: UserPermission[];
  
  
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
