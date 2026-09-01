import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Customers } from '../customers/entities/customers.entity';
import { Users } from '../user/entities/user.entity';
import { OrderStatus } from '../status/entities/status.entity';
import { DeliveryPartner } from '../delivery-partner/entities/delivery-partner.entity';
import { Products } from '../order/entities/products.entity';
import { Product } from '../product/entity/product.entity';
import { Expense } from '../finance/entities/expense.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { SupplierBill } from '../finance/entities/supplier-bill.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Customers,
      Users,
      OrderStatus,
      DeliveryPartner,
      Products,
      Product,
      Expense,
      InventoryItem,
      SupplierBill,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
