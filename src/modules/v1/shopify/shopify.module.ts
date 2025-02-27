import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { OrderService } from '../order/order.service';
import { OrderController } from '../order/order.controller';
import { OrderModule } from '../order/order.module';  // Make sure this is imported
import { ProductModule } from '../product/product.module';
import { ShopifyController } from './shopify.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), OrderModule], // Import the OrderModule here
  providers: [],
  controllers: [ShopifyController],
})
export class ShopifyModule {}
