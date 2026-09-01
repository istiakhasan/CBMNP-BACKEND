import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LogisticsOperationsService } from './logistics-operations.service';
import { Request } from 'express';

@ApiTags('Logistics & Dispatch Operations')
@Controller('v1/logistics-operations')
export class LogisticsOperationsController {
  constructor(private readonly logisticsOpsService: LogisticsOperationsService) {}

  // Routing Rules
  @Post('routing-rules')
  @ApiOperation({ summary: 'Create automated courier routing rule' })
  async createRoutingRule(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.createRoutingRule(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('routing-rules')
  @ApiOperation({ summary: 'Get all courier routing rules' })
  async getRoutingRules(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.getRoutingRules(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Rate Matrix
  @Post('rate-matrix')
  @ApiOperation({ summary: 'Set courier weight/zone shipping rates' })
  async setRateMatrix(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.setRateMatrix(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('rate-matrix')
  @ApiOperation({ summary: 'Get all courier shipping rate matrices' })
  async getRateMatrices(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.getRateMatrices(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Warehouse Pick Lists
  @Post('pick-lists')
  @ApiOperation({ summary: 'Generate aggregated warehouse pick list from orders' })
  async generatePickList(
    @Body() body: { orderIds: string[]; warehouseId: string; pickerId?: string },
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.generatePickList(body.orderIds, body.warehouseId, orgId, body.pickerId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Warehouse pick list generated', data: result };
  }

  @Get('pick-lists')
  @ApiOperation({ summary: 'Get all warehouse pick lists' })
  async getPickLists(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.getPickLists(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Courier COD Settlements
  @Post('settlements')
  @ApiOperation({ summary: 'Record and reconcile courier COD settlement statement' })
  async reconcileSettlement(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.reconcileSettlement(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Courier settlement recorded', data: result };
  }

  @Get('settlements')
  @ApiOperation({ summary: 'Get all courier settlements' })
  async getSettlements(
    @Query('partnerId') partnerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.logisticsOpsService.getSettlements(
      orgId,
      partnerId,
      startDate,
      endDate,
    );
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
