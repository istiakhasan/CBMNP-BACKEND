import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";

@Entity({ name: 'attribute' })
export class Attribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  attributeName: string;

  @Column()
  label: string;

  @ManyToOne(() => Product, (product) => product.attributes)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: number;
}
