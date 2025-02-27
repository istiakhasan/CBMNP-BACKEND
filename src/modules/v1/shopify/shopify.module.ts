import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { OrderService } from '../order/order.service';
import { OrderController } from '../order/order.controller';
import { OrderModule } from '../order/order.module';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [],
  controllers: [],

})
export class ShopifyModule {}
