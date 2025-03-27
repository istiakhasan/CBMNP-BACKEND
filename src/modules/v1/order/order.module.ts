import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { ProductModule } from '../product/product.module';
import { Product } from '../product/entity/product.entity';
import { OrderStatus } from '../status/entities/status.entity';
import { Customers } from '../customers/entities/customers.entity';
import { Users } from '../user/entities/user.entity';
import { Products } from './entities/products.entity';
import { PaymentHistory } from './entities/paymentHistory.entity';
import { OrdersLog } from './entities/orderlog.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { RequsitionModule } from '../requsition/requsition.module';
import { DeliveryPartner } from '../delivery-partner/entities/delivery-partner.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([Order,DeliveryPartner,Product,OrderStatus,Customers,Users,Products,PaymentHistory,OrdersLog,Organization,Inventory,InventoryItem]),RequsitionModule
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
