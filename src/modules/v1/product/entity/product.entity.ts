import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Products } from '../../order/entities/products.entity';

@Entity({ name: 'product' })
export class Product {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'text', array: true, nullable: false })
  images: string[];

  @Column({ nullable: false })
  name: string;
  @Column({ nullable: false, type: 'text' })
  description: string;
  @Column({ nullable: false, type: 'text' })
  weight: string;
  @Column({ nullable: false, type: 'text' })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  regularPrice: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salePrice: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  retailPrice: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  distributionPrice: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  purchasePrice: number;

  @OneToMany(() => Products, (products) => products.product)
  products: Products[];

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
