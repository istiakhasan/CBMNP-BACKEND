import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierRoutingRule } from './entities/courier-routing-rule.entity';
import { ShippingRateMatrix } from './entities/shipping-rate-matrix.entity';
import { WarehousePickList } from './entities/warehouse-pick-list.entity';
import { PickListItem } from './entities/pick-list-item.entity';
import { CourierSettlement } from './entities/courier-settlement.entity';
import { Order } from '../order/entities/order.entity';
import { Products as OrderProduct } from '../order/entities/products.entity';
import { DeliveryPartner } from '../delivery-partner/entities/delivery-partner.entity';
import { LogisticsOperationsService } from './logistics-operations.service';
import { LogisticsOperationsController } from './logistics-operations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourierRoutingRule,
      ShippingRateMatrix,
      WarehousePickList,
      PickListItem,
      CourierSettlement,
      Order,
      OrderProduct,
      DeliveryPartner,
    ]),
  ],
  controllers: [LogisticsOperationsController],
  providers: [LogisticsOperationsService],
  exports: [LogisticsOperationsService],
})
export class LogisticsOperationsModule {}
