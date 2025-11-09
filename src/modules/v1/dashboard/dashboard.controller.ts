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
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { Request } from 'express';

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
  async getDashboardSummary(@Req() req?: Request) {
    const organizationId = req.headers['x-organization-id'];
    const data = await this.dashboardService.getDashboardSummary(
      organizationId as string,
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
