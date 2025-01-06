import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { Products } from '../order/entities/products.entity';
import { Product } from './entity/product.entity';
import { ProductImages } from './entity/image.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([Products]),
    TypeOrmModule.forFeature([Product]),
    TypeOrmModule.forFeature([ProductImages]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports:[ProductService]
})
export class ProductModule {}
