import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseLocation } from './entities/warehouse-location.entity';
import { StockTransfer } from './entities/stock-transfer.entity';
import { StockTransferItem } from './entities/stock-transfer-item.entity';
import { StockAdjustment } from './entities/stock-adjustment.entity';
import { StockAdjustmentItem } from './entities/stock-adjustment-item.entity';
import { ProductBatch } from './entities/product-batch.entity';
import { ProductReorderRule } from './entities/reorder-rule.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Product } from '../product/entity/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { InventoryOperationsService } from './inventory-operations.service';
import { InventoryOperationsController } from './inventory-operations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseLocation,
      StockTransfer,
      StockTransferItem,
      StockAdjustment,
      StockAdjustmentItem,
      ProductBatch,
      ProductReorderRule,
      Inventory,
      InventoryItem,
      Transaction,
      Product,
      Warehouse,
    ]),
  ],
  controllers: [InventoryOperationsController],
  providers: [InventoryOperationsService],
  exports: [InventoryOperationsService],
})
export class InventoryOperationsModule {}
