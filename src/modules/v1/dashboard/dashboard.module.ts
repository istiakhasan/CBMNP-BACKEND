import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Customers } from '../customers/entities/customers.entity';
import { Users } from '../user/entities/user.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([Order,Customers,Users])
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
