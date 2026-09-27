import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DmsArea,
  DmsDeliveryTrip,
  DmsDeliveryTripOrder,
  DmsDistributor,
  DmsDistributorInventory,
  DmsPrimaryOrder,
  DmsPrimaryOrderItem,
  DmsRegion,
  DmsRetailer,
  DmsReturn,
  DmsReturnItem,
  DmsSalesOrder,
  DmsSalesOrderItem,
  DmsScheme,
  SfaCollection,
  SfaFieldAttendance,
  SfaFieldVisit,
  SfaRoute,
  SfaSalesTarget,
  SfaTerritory,
} from './entities/sfa-dms.entity';
import { SfaDmsController } from './sfa-dms.controller';
import { SfaDmsService } from './sfa-dms.service';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DmsRegion,
      DmsArea,
      SfaTerritory,
      DmsDistributor,
      DmsRetailer,
      SfaRoute,
      SfaFieldAttendance,
      SfaFieldVisit,
      DmsSalesOrder,
      DmsSalesOrderItem,
      DmsPrimaryOrder,
      DmsPrimaryOrderItem,
      DmsDistributorInventory,
      SfaCollection,
      DmsScheme,
      DmsDeliveryTrip,
      DmsDeliveryTripOrder,
      DmsReturn,
      DmsReturnItem,
      SfaSalesTarget,
    ]),
    GovernanceModule,
  ],
  controllers: [SfaDmsController],
  providers: [SfaDmsService],
  exports: [SfaDmsService],
})
export class SfaDmsModule {}

