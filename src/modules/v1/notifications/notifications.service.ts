import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsTemplate, NotificationTriggerEvent } from './entities/sms-template.entity';
import { SmsLog, NotificationDeliveryStatus } from './entities/sms-log.entity';
import { EmailLog } from './entities/email-log.entity';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(SmsTemplate)
    private readonly smsTemplateRepo: Repository<SmsTemplate>,
    @InjectRepository(SmsLog)
    private readonly smsLogRepo: Repository<SmsLog>,
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(WebhookEndpoint)
    private readonly webhookEndpointRepo: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookDeliveryLog)
    private readonly webhookDeliveryLogRepo: Repository<WebhookDeliveryLog>,
  ) {}

  // ================= SMS TEMPLATES =================
  async createTemplate(data: Partial<SmsTemplate>, organizationId: string): Promise<SmsTemplate> {
    const existing = await this.smsTemplateRepo.findOne({
      where: { organizationId, triggerEvent: data.triggerEvent },
    });
    if (existing) {
      existing.templateBody = data.templateBody || existing.templateBody;
      existing.isActive = data.isActive !== undefined ? data.isActive : existing.isActive;
      return this.smsTemplateRepo.save(existing);
    }

    const tpl = this.smsTemplateRepo.create({ ...data, organizationId });
    return this.smsTemplateRepo.save(tpl);
  }

  async getTemplates(organizationId: string): Promise<SmsTemplate[]> {
    return this.smsTemplateRepo.find({ where: { organizationId } });
  }

  // ================= NON-BLOCKING SMS DISPATCHER =================
  async triggerEventSms(
    event: NotificationTriggerEvent,
    recipientPhone: string,
    variables: Record<string, any>,
    organizationId: string,
    orderId?: string,
  ) {
    // Non-blocking async wrapper
    try {
      if (!recipientPhone) return;

      const template = await this.smsTemplateRepo.findOne({
        where: { organizationId, triggerEvent: event, isActive: true },
      });

      if (!template) return;

      let message = template.templateBody;
      Object.keys(variables).forEach((key) => {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(variables[key] || ''));
      });

      // Log outbound SMS
      const log = this.smsLogRepo.create({
        recipientPhone,
        messageBody: message,
        status: NotificationDeliveryStatus.SENT,
        gatewayProvider: 'SSLWireless-Mock',
        gatewayResponse: 'SUCCESS: SMS queued for delivery',
        orderId,
        organizationId,
      });

      await this.smsLogRepo.save(log);
    } catch (err: any) {
      // Failed SMS never crashes calling process
      try {
        const failLog = this.smsLogRepo.create({
          recipientPhone: recipientPhone || 'N/A',
          messageBody: 'Failed to format/send SMS',
          status: NotificationDeliveryStatus.FAILED,
          gatewayProvider: 'SSLWireless-Mock',
          gatewayResponse: err?.message || 'Error occurred',
          orderId,
          organizationId,
        });
        await this.smsLogRepo.save(failLog);
      } catch (innerErr) {
        // Silently ignore log errors
      }
    }
  }

  async getSmsLogs(organizationId: string) {
    return this.smsLogRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // ================= OUTBOUND WEBHOOKS =================
  async createWebhookEndpoint(data: Partial<WebhookEndpoint>, organizationId: string): Promise<WebhookEndpoint> {
    const secretKey = data.secretKey || crypto.randomBytes(24).toString('hex');
    const endpoint = this.webhookEndpointRepo.create({
      ...data,
      secretKey,
      organizationId,
    });
    return this.webhookEndpointRepo.save(endpoint);
  }

  async getWebhookEndpoints(organizationId: string): Promise<WebhookEndpoint[]> {
    return this.webhookEndpointRepo.find({ where: { organizationId } });
  }

  async dispatchOutboundEvent(eventName: string, payload: any, organizationId: string) {
    try {
      const endpoints = await this.webhookEndpointRepo.find({
        where: { organizationId, isActive: true },
      });

      const subscribed = endpoints.filter((ep) =>
        ep.subscribedEvents.includes(eventName) || ep.subscribedEvents.includes('*'),
      );

      for (const ep of subscribed) {
        const payloadString = JSON.stringify({
          event: eventName,
          timestamp: new Date().toISOString(),
          data: payload,
        });

        const signature = crypto
          .createHmac('sha256', ep.secretKey)
          .update(payloadString)
          .digest('hex');

        // Asynchronously dispatch HTTP request
        axios
          .post(ep.url, JSON.parse(payloadString), {
            headers: {
              'Content-Type': 'application/json',
              'X-CBMNP-Signature': signature,
              'X-CBMNP-Event': eventName,
            },
            timeout: 5000,
          })
          .then((res) => {
            const log = this.webhookDeliveryLogRepo.create({
              endpointId: ep.id,
              eventName,
              payload,
              responseStatusCode: res.status,
              responseBody: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
              isSuccess: true,
              organizationId,
            });
            this.webhookDeliveryLogRepo.save(log);
          })
          .catch((err) => {
            const log = this.webhookDeliveryLogRepo.create({
              endpointId: ep.id,
              eventName,
              payload,
              responseStatusCode: err.response?.status || 500,
              responseBody: err.message,
              isSuccess: false,
              organizationId,
            });
            this.webhookDeliveryLogRepo.save(log);
          });
      }
    } catch (err) {
      // Outbound dispatch failure is completely non-blocking
    }
  }

  async getWebhookLogs(organizationId: string) {
    return this.webhookDeliveryLogRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: ['endpoint'],
      take: 100,
    });
  }
}
