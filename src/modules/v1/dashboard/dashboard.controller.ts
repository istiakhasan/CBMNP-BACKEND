import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { Request } from 'express';
import { AuthGuard } from 'src/middleware/auth.guard';
import { Roles } from 'src/middleware/roles.decorator';

@Controller('v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get('/monthly-report')
  async getDashboardData(
    @Query('year') year: number = new Date().getFullYear(),
    @Req() req?: Request,
  ) {
    const organizationId = req.headers['x-organization-id'];
    const data = await this.dashboardService.getMonthlyDashboardData(
      year,
      organizationId as string,
    );
    return { series: [{ name: 'Total', data }] };
  }
  @Get('/total-summary')
  async getDashboardSummary(
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: Request,
  ) {
    const organizationId = req.headers['x-organization-id'];
    const data = await this.dashboardService.getDashboardSummary(
      organizationId as string,
      period,
      startDate,
      endDate,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Dashboard Summary retrieved successfully',
      data: data,
    };
  }
  @Get('/status-distribution')
  async getStatusDistribution(@Req() req?: Request) {
    const organizationId = req.headers['x-organization-id'];
    const data = await this.dashboardService.getOrderStatusDistribution(
      organizationId as string,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Order Distribution Retrieved successfully',
      data: data,
    };
  }
  @Get('/partner-distribution')
  async getPartnerWisedistribution(@Req() req?: Request) {
    const organizationId = req.headers['x-organization-id'];
    const data = await this.dashboardService.getDeliveryPartnerDistribution(
      organizationId as string,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Warehouse wise order Distribution Retrieved successfully',
      data: data,
    };
  }
  @Get('/top-selling-products')
  async getTopSellingProducts(@Req() req?: Request) {
    const organizationId = req.headers['x-organization-id'];
    const data = await this.dashboardService.getTopSellingItems(
      organizationId as string,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Top Selling Retrieved successfully',
      data: data,
    };
  }

  @Get('area-distribution')
  async getAreaDistribution(
    @Req() req: Request,
    @Query('level') level: 'division' | 'district' | 'thana',
    @Query('period') period: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('statusId') statusId?: string, // comma-separated: "4,10,13"
  ) {
    const statusIds = statusId
      ? statusId
          .split(',')
          .map(Number)
          .filter((n) => !isNaN(n))
      : undefined;
    const organizationId = req.headers['x-organization-id'];
    return this.dashboardService.getAreaWiseDistribution(
      organizationId as string,
      level,
      period,
      startDate,
      endDate,
      statusIds,
    );
  }

  @UseGuards(AuthGuard)
  @Roles('user')
  @Get('agent-summary')
  async getAgentDashboardSummary(@Req() req: any) {
    const organizationId = req.headers['x-organization-id'];
    return this.dashboardService.getAgentDashboardSummary(
      organizationId,
      req.user.userId,
    );
  }
  @Post()
  create(@Body() createDashboardDto: CreateDashboardDto) {
    return this.dashboardService.create(createDashboardDto);
  }

  @Get()
  findAll() {
    return this.dashboardService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dashboardService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDashboardDto: UpdateDashboardDto,
  ) {
    return this.dashboardService.update(+id, updateDashboardDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dashboardService.remove(+id);
  }
}
