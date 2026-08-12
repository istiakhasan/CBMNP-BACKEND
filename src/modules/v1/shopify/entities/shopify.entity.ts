import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'shopify' })
export class Shopify {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  domain: string;

  @Column({ nullable: true })
  secret: string;

  @Column({ nullable: true, type: 'text' })
  accessToken: string;

  @Column({ nullable: true })
  organizationId: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}