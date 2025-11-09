import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/entity/product.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Inventory } from './entities/inventory.entity';
import { InventoryItem } from './entities/inventoryitem.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Product,Transaction,Inventory,InventoryItem])],
  controllers: [InventoryController],
  providers: [InventoryService],
   exports: [InventoryService],
})
export class InventoryModule {}
