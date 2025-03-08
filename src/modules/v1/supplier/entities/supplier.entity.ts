import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'supplier' })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ nullable: true })
  company: string;
  @Column({ nullable: true })
  contactPerson: string;
  @Column({ nullable: true })
  phone: string;
  @Column({ nullable: true })
  email: string;
  @Column({ nullable: true })
  organizationId: string;

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
