import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/entity/product.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Inventory } from './entities/inventory.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Product,Transaction,Inventory])],
  controllers: [InventoryController],
  providers: [InventoryService]
})
export class InventoryModule {}
