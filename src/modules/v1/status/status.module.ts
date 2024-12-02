import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { OrderStatus } from './entities/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderStatus])],
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
