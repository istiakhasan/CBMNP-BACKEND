import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseReturn } from './entities/purchase-return.entity';
import { PurchaseReturnItem } from './entities/purchase-return-item.entity';
import { GoodsReceiptNote } from './entities/goods-receipt-note.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { RFQ } from './entities/rfq.entity';
import { SupplierQuotation } from './entities/supplier-quotation.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PurchaseReturnsController } from './purchase-returns.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseReturn,
      PurchaseReturnItem,
      GoodsReceiptNote,
      GoodsReceiptItem,
      RFQ,
      SupplierQuotation,
      Inventory,
      InventoryItem,
      Transaction,
      Supplier,
    ]),
  ],
  controllers: [PurchaseReturnsController],
  providers: [PurchaseReturnsService],
  exports: [PurchaseReturnsService],
})
export class PurchaseReturnsModule {}
