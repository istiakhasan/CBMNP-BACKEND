import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";

@Entity({name:'product_images'})
export class ProductImages{
    @PrimaryGeneratedColumn('uuid')
    id:string;
    @Column()
    url:string;
    @Column()
    delete_url:string;
    @Column()
    productId: string;
    @ManyToOne(() => Product, (product) => product.images)
    @JoinColumn({ name: 'productId' })
    product: Product;
}