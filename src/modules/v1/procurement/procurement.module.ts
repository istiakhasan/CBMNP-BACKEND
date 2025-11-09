import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { Supplier } from '../supplier/entities/supplier.entity';
import { Procurement } from './entities/procurement.entity';
import { ProcurementItem } from './entities/procurementItem.entity';
import { InvoiceCounter } from './entities/invoice-counter.entity';
import { InventoryModule } from '../inventory/inventory.module';


@Module({
  imports: [TypeOrmModule.forFeature([Procurement, ProcurementItem, Supplier,InvoiceCounter]),InventoryModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
})
export class ProcurementModule {}
