import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { WebhookService } from './webhook.service';

import { SteadfastWebhookDto } from './dto/steadfast-webhook.dto';

@Controller('v1/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post('steadfast')
  @HttpCode(200)
  async steadfastWebhook(
    @Body() payload: SteadfastWebhookDto,

    @Headers('authorization')
    authorization?: string,
  ) {
    /**
     * ---------------------------------------------------
     * Authentication
     * ---------------------------------------------------
     */

    const webhookToken = this.configService.get<string>(
      'STEADFAST_WEBHOOK_TOKEN',
    );

    if (!webhookToken) {
      this.logger.error('STEADFAST_WEBHOOK_TOKEN is not configured');

      throw new UnauthorizedException('Webhook token is not configured');
    }

    /**
     * Expected:
     *
     * Authorization: Bearer xxxxxxxxx
     */

    const expectedAuthorization = `Bearer ${webhookToken}`;

    if (authorization !== expectedAuthorization) {
      this.logger.warn('Invalid Steadfast webhook authorization');

      throw new UnauthorizedException('Invalid webhook token');
    }

    /**
     * ---------------------------------------------------
     * Process webhook
     * ---------------------------------------------------
     */

    return this.webhookService.handleSteadfastWebhook(payload);
  }
}
