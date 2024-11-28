import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
  } from 'typeorm';
  import { Users } from '../../user/entities/user.entity';
  import { Permission } from '../../permission/entities/permission.entity';
  
  @Entity({ name: 'userpermission' })
  @Unique('user_permission_unique', ['userId', 'permissionId']) 
  export class UserPermission {
    @PrimaryGeneratedColumn('increment')
    id: number;
  
    @Column({ nullable: false })
    userId: number;
  
    @Column({ nullable: false })
    permissionId: number;
  
    @ManyToOne(() => Users, (user) => user.userPermissions, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'userId',referencedColumnName:'userId' })
    user: Users;
  
    @ManyToOne(() => Permission, (permission) => permission.userPermissions, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'permissionId' })
    permission: Permission;
  
    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
  
    @UpdateDateColumn({
      type: 'timestamp',
      default: () => 'CURRENT_TIMESTAMP',
      onUpdate: 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date;
  }
  