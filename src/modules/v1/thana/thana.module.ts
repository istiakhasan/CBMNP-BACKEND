import { Module } from '@nestjs/common';
import { ThanaService } from './thana.service';
import { ThanaController } from './thana.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Thana } from './entities/thana.entity';
import { DistrictsModule } from '../districts/districts.module';
import { DelivaryCharge } from '../delivary_charge/entities/delivary_charge.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Thana, DelivaryCharge]), DistrictsModule],
  controllers: [ThanaController],
  providers: [ThanaService],
})
export class ThanaModule {}
