import { Module } from '@nestjs/common';
import {  OrderServiceV2 } from './order.service';
import {  OrderControllerv2 } from './order.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequsitionModule } from 'src/modules/v1/requsition/requsition.module';
import { Order } from 'src/modules/v1/order/entities/order.entity';
import { DeliveryPartner } from 'src/modules/v1/delivery-partner/entities/delivery-partner.entity';
import { Product } from 'src/modules/v1/product/entity/product.entity';
import { OrderStatus } from 'src/modules/v1/status/entities/status.entity';
import { Customers } from 'src/modules/v1/customers/entities/customers.entity';
import { Users } from 'src/modules/v1/user/entities/user.entity';
import { Products } from 'src/modules/v1/order/entities/products.entity';
import { PaymentHistory } from 'src/modules/v1/order/entities/paymentHistory.entity';
import { OrdersLog } from 'src/modules/v1/order/entities/orderlog.entity';
import { Organization } from 'src/modules/v1/organization/entities/organization.entity';
import { Inventory } from 'src/modules/v1/inventory/entities/inventory.entity';
import { InventoryItem } from 'src/modules/v1/inventory/entities/inventoryitem.entity';
import { OrderProductReturn } from 'src/modules/v1/order/entities/return_damage.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      DeliveryPartner,
      Product,
      OrderStatus,
      Customers,
      Users,
      Products,
      PaymentHistory,
      OrdersLog,
      Organization,
      Inventory,
      InventoryItem,
      OrderProductReturn,
    ]),
    RequsitionModule,
  ],
  controllers: [OrderControllerv2],
  providers: [OrderServiceV2],
  exports: [OrderServiceV2],
})
export class OrderModuleV2 {}
