import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsTemplate } from './entities/sms-template.entity';
import { SmsLog } from './entities/sms-log.entity';
import { EmailLog } from './entities/email-log.entity';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SmsTemplate,
      SmsLog,
      EmailLog,
      WebhookEndpoint,
      WebhookDeliveryLog,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
