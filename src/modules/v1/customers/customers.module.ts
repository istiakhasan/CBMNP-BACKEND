import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';
import { Customers } from './entities/customers.entity';
import { CustomerController } from './customers.controller';
import { CustomerService } from './customers.service';
@Module({
   imports: [TypeOrmModule.forFeature([Customers])],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}