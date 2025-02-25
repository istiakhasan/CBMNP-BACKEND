import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";

@Entity({ name: 'attribute' })
export class Attribute {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column()
  attributeName: string;

  @Column()
  label: string;
  @Column()
  productId: string;
  @ManyToOne(() => Product, (product) => product.attributes)
  @JoinColumn({ name: 'productId' })
  product: Product;

 
}
