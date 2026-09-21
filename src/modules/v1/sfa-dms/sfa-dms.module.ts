import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DmsArea, DmsDistributor, DmsRegion, DmsRetailer, DmsSalesOrder, DmsSalesOrderItem, SfaCollection, SfaFieldVisit, SfaRoute, SfaSalesTarget, SfaTerritory } from './entities/sfa-dms.entity';
import { SfaDmsController } from './sfa-dms.controller';
import { SfaDmsService } from './sfa-dms.service';
import { GovernanceModule } from '../governance/governance.module';

@Module({ imports: [TypeOrmModule.forFeature([DmsRegion, DmsArea, SfaTerritory, DmsDistributor, DmsRetailer, SfaRoute, SfaFieldVisit, DmsSalesOrder, DmsSalesOrderItem, SfaCollection, SfaSalesTarget]), GovernanceModule], controllers: [SfaDmsController], providers: [SfaDmsService] })
export class SfaDmsModule {}
