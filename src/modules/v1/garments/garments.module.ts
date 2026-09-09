import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GarmentsBuyerOrder } from './entities/garmentsBuyerOrder.entity';
import { GarmentsBOM } from './entities/garmentsBom.entity';
import { GarmentsBOMItem } from './entities/garmentsBomItem.entity';
import { GarmentsPO } from './entities/garmentsPo.entity';
import { GarmentsPOItem } from './entities/garmentsPoItem.entity';
import { GarmentsInventory } from './entities/garmentsInventory.entity';
import { GarmentsInventoryLot } from './entities/garmentsInventoryLot.entity';
import { GarmentsInventoryAdjustment } from './entities/garmentsAdjustment.entity';
import { GarmentsMaterialIssue } from './entities/garmentsMaterialIssue.entity';
import { GarmentsInvoiceCounter } from './entities/garmentsInvoiceCounter.entity';
import { GarmentsService } from './garments.service';
import { GarmentsController } from './garments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GarmentsBuyerOrder,
      GarmentsBOM,
      GarmentsBOMItem,
      GarmentsPO,
      GarmentsPOItem,
      GarmentsInventory,
      GarmentsInventoryLot,
      GarmentsInventoryAdjustment,
      GarmentsMaterialIssue,
      GarmentsInvoiceCounter,
    ]),
  ],
  controllers: [GarmentsController],
  providers: [GarmentsService],
  exports: [GarmentsService],
})
export class GarmentsModule {}
