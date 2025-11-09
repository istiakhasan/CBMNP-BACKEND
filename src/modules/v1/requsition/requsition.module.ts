import { Module } from '@nestjs/common';

import { RequsitionController } from './requsition.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Requisition } from './entities/requsition.entity';
import { RequisitionService } from './requsition.service';
import { Order } from '../order/entities/order.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Products } from '../order/entities/products.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { OrdersLog } from '../order/entities/orderlog.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([Requisition,Order,Inventory,Products,InventoryItem,OrdersLog])
  ],
  controllers: [RequsitionController],
  providers: [RequisitionService],
  exports:[RequisitionService]
})
export class RequsitionModule {}
