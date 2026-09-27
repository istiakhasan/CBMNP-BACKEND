import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EcommerceBanner,
  EcommerceCollection,
  EcommerceCoupon,
  EcommercePage,
  EcommerceReview,
  EcommerceSection,
  EcommerceSetting,
  EcommerceShippingRule,
} from './entities/ecommerce.entity';
import { EcommerceService } from './ecommerce.service';
import { EcommerceController } from './ecommerce.controller';

import { Product } from '../product/entity/product.entity';
import { Order } from '../order/entities/order.entity';
import { Products } from '../order/entities/products.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EcommerceSetting,
      EcommerceBanner,
      EcommerceSection,
      EcommerceCollection,
      EcommerceCoupon,
      EcommerceShippingRule,
      EcommerceReview,
      EcommercePage,
      Product,
      Order,
      Products,
      Inventory,
    ]),
  ],
  controllers: [EcommerceController],
  providers: [EcommerceService],
  exports: [EcommerceService],
})
export class EcommerceModule {}
