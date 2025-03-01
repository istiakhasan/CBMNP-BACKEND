import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { OrderModule } from '../order/order.module';
import { WebhookController } from './shopify.controller';
import { ShopifyWebhookService } from './shopify.service';
import { Products } from '../order/entities/products.entity';
import { Shopify } from './entities/shopify.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Order,Products,Shopify]), OrderModule],
  providers: [ShopifyWebhookService],
  controllers: [WebhookController],
})
export class ShopifyModule {}
