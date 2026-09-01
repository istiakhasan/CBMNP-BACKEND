import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { Request } from 'express';

@ApiTags('Notifications & Outbound Webhooks')
@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // SMS Templates
  @Post('sms-templates')
  @ApiOperation({ summary: 'Create or update automated SMS template' })
  async createTemplate(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.notificationsService.createTemplate(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('sms-templates')
  @ApiOperation({ summary: 'Get all SMS templates' })
  async getTemplates(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.notificationsService.getTemplates(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('sms-logs')
  @ApiOperation({ summary: 'Get outbound SMS logs' })
  async getSmsLogs(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.notificationsService.getSmsLogs(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Webhooks
  @Post('webhooks/endpoints')
  @ApiOperation({ summary: 'Register outbound webhook endpoint' })
  async createWebhookEndpoint(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.notificationsService.createWebhookEndpoint(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('webhooks/endpoints')
  @ApiOperation({ summary: 'Get registered webhook endpoints' })
  async getWebhookEndpoints(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.notificationsService.getWebhookEndpoints(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('webhooks/logs')
  @ApiOperation({ summary: 'Get outbound webhook delivery logs' })
  async getWebhookLogs(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.notificationsService.getWebhookLogs(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
