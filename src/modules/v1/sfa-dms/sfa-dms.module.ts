import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DmsDistributor, DmsRetailer, DmsSalesOrder, DmsSalesOrderItem, SfaCollection, SfaFieldVisit, SfaRoute, SfaSalesTarget, SfaTerritory } from './entities/sfa-dms.entity';
import { SfaDmsController } from './sfa-dms.controller';
import { SfaDmsService } from './sfa-dms.service';
import { GovernanceModule } from '../governance/governance.module';

@Module({ imports: [TypeOrmModule.forFeature([SfaTerritory, DmsDistributor, DmsRetailer, SfaRoute, SfaFieldVisit, DmsSalesOrder, DmsSalesOrderItem, SfaCollection, SfaSalesTarget]), GovernanceModule], controllers: [SfaDmsController], providers: [SfaDmsService] })
export class SfaDmsModule {}
