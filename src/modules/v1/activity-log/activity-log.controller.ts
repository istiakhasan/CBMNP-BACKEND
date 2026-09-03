import { Body, Controller, Get, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

@ApiTags('Activity Logs')
@Controller('v1/activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Post()
  @ApiOperation({ summary: 'Create manual activity log' })
  async create(@Body() data: CreateActivityLogDto, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const user = (req as any).user;
    const result = await this.activityLogService.create(
      {
        ...data,
        userId: data.userId || user?.userId || user?.id,
        userName: data.userName || user?.name,
        method: 'MANUAL',
        path: req.originalUrl || req.url,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      orgId,
    );

    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'Get project activity logs' })
  async findAll(@Query() query: ActivityLogQueryDto, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.activityLogService.findAll(query, orgId);
    return { success: true, statusCode: HttpStatus.OK, ...result };
  }
}
