import { Module } from '@nestjs/common';
import { DelivaryChargeService } from './delivary_charge.service';
import { DelivaryChargeController } from './delivary_charge.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DelivaryCharge } from './entities/delivary_charge.entity';
import { Thana } from '../thana/entities/thana.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DelivaryCharge, Thana])],
  controllers: [DelivaryChargeController],
  providers: [DelivaryChargeService],
})
export class DelivaryChargeModule {}
