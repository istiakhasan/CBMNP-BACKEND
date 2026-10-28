import { forwardRef, Module } from '@nestjs/common';
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
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { ShopifyInventorySyncService } from './shopify-inventory-sync.service';
import { ShopifyInventorySyncOutbox } from './entities/shopify-inventory-sync.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Order,Products,Shopify,Product,ProductImages,Customers,Warehouse,ProductPriceHistory,Inventory,InventoryItem,ShopifyInventorySyncOutbox]), forwardRef(() => OrderModule)],
  providers: [ShopifyWebhookService, ShopifyInventorySyncService],
  exports: [ShopifyInventorySyncService],
  controllers: [WebhookController],
})
export class ShopifyModule {}
