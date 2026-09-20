import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { Warehouse } from './entities/warehouse.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';

@Module({
  controllers: [WarehouseController],
  providers: [WarehouseService],
    imports:[
      TypeOrmModule.forFeature([Warehouse, InventoryItem])
    ],
})
export class WarehouseModule {}
