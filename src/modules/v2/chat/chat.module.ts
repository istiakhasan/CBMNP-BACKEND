import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatMessage } from './chat.entity';
import { Products } from 'src/modules/v1/order/entities/products.entity';
import { Customers } from 'src/modules/v1/customers/entities/customers.entity';
import { PaymentHistory } from 'src/modules/v1/order/entities/paymentHistory.entity';
import { Order } from 'src/modules/v1/order/entities/order.entity';
import { Inventory } from 'src/modules/v1/inventory/entities/inventory.entity';
import { Warehouse } from 'src/modules/v1/warehouse/entities/warehouse.entity';
import { OrderModule } from 'src/modules/v1/order/order.module'; // import the module containing OrderService
import { Product } from 'src/modules/v1/product/entity/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatMessage,
      Products,
      Customers,
      PaymentHistory,
      Order,
      Inventory,
      Warehouse,
      Product
    ]),
    HttpModule,
    OrderModule, // <-- this makes OrderService available for injection
  ],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
