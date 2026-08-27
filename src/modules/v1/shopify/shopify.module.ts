import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { OrderModule } from '../order/order.module';
import { WebhookController } from './shopify.controller';
import { ShopifyWebhookService } from './shopify.service';
import { Products } from '../order/entities/products.entity';
import { Shopify } from './entities/shopify.entity';
import { Product } from '../product/entity/product.entity';
import { ProductImages } from '../product/entity/image.entity';
import { Customers } from '../customers/entities/customers.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { ProductPriceHistory } from '../product/entity/productPriceHistory.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Order,Products,Shopify,Product,ProductImages,Customers,Warehouse,ProductPriceHistory]), OrderModule],
  providers: [ShopifyWebhookService],
  controllers: [WebhookController],
})
export class ShopifyModule {}
