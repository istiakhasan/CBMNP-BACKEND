import { BadRequestException, Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { SfaDmsService } from './sfa-dms.service';

@Controller('v1/sfa-dms')
export class SfaDmsController {
  constructor(private readonly service: SfaDmsService) {}
  private organizationId(req: any): string {
    const organizationId = req.headers['x-organization-id'];
    if (!organizationId || typeof organizationId !== 'string') throw new BadRequestException('x-organization-id header is required');
    return organizationId;
  }
  @Get('dashboard') async dashboard(@Req() req: any) { return { success: true, statusCode: HttpStatus.OK, data: await this.service.dashboard(this.organizationId(req)) }; }
  @Get(':resource') async list(@Param('resource') resource: string, @Query() query: any, @Req() req: any) {
    const result = await this.service.list(resource, this.organizationId(req), query.page, query.limit, query.searchTerm);
    return { success: true, statusCode: HttpStatus.OK, ...result };
  }
  @Post(':resource') async create(@Param('resource') resource: string, @Body() data: any, @Req() req: any) {
    return { success: true, statusCode: HttpStatus.OK, data: await this.service.create(resource, this.organizationId(req), data, req.user?.userId) };
  }
  @Patch(':resource/:id') async update(@Param('resource') resource: string, @Param('id') id: string, @Body() data: any, @Req() req: any) {
    return { success: true, statusCode: HttpStatus.OK, data: await this.service.update(resource, id, this.organizationId(req), data, req.user?.userId) };
  }
}
