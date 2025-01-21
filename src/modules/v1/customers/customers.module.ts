import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Customers } from './entities/customers.entity';
import { CustomerController } from './customers.controller';
import { CustomerService } from './customers.service';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../status/entities/status.entity';
@Module({
   imports: [TypeOrmModule.forFeature([Customers,Order,OrderStatus])],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}