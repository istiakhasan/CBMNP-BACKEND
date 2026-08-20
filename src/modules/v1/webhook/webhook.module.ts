import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@nestjs/config';

import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../status/entities/status.entity';


@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Order,OrderStatus])],

  controllers: [WebhookController],

  providers: [WebhookService],

  exports: [WebhookService],
})
export class WebhookModule {}
