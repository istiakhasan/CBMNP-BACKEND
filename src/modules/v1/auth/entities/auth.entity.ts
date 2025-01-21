import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

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
  cs_website_agent = 'cs_website_agent',
}

@Entity({ name: 'userauth' })
export class UserAuth {
  @PrimaryGeneratedColumn()
  id: number; // Primary key

  @Column({ type: 'varchar', comment: 'User ID' })
  userId: string;

  @Column({ type: 'varchar', comment: 'Username' })
  userName: string;

  @Column({ type: 'enum', enum: UserRole, comment: 'User Role' })
  role: UserRole;

  @Column({ type: 'varchar', comment: 'Password' })
  password: string;

  @Column({ type: 'varchar', nullable: true, comment: 'Image' })
  image: string;
  @Column({ type: 'varchar', nullable: true })
  kashemId: string;

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
