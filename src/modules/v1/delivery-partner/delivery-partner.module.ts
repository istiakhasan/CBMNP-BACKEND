import { Module } from '@nestjs/common';
import { DeliveryPartnerService } from './delivery-partner.service';
import { DeliveryPartnerController } from './delivery-partner.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryPartner } from './entities/delivery-partner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryPartner])],
  controllers: [DeliveryPartnerController],
  providers: [DeliveryPartnerService],
})
export class DeliveryPartnerModule {}
