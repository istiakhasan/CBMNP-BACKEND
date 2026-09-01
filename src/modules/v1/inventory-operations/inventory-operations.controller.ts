import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  Req,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventoryOperationsService } from './inventory-operations.service';
import { Request } from 'express';

@ApiTags('Inventory Operations')
@Controller('v1/inventory-operations')
export class InventoryOperationsController {
  constructor(private readonly inventoryOpsService: InventoryOperationsService) {}

  // Locations
  @Post('locations')
  @ApiOperation({ summary: 'Create bin/rack/shelf location' })
  async createLocation(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.createLocation(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('locations/:warehouseId')
  @ApiOperation({ summary: 'Get locations for a warehouse' })
  async getLocations(@Param('warehouseId') warehouseId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.getLocations(warehouseId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Transfers
  @Post('transfers')
  @ApiOperation({ summary: 'Create inter-warehouse stock transfer request' })
  async createTransfer(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.inventoryOpsService.createTransfer(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Patch('transfers/:id/dispatch')
  @ApiOperation({ summary: 'Dispatch stock transfer from source warehouse' })
  async dispatchTransfer(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.inventoryOpsService.dispatchTransfer(id, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Stock dispatched successfully', data: result };
  }

  @Patch('transfers/:id/receive')
  @ApiOperation({ summary: 'Receive stock transfer at destination warehouse' })
  async receiveTransfer(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.inventoryOpsService.receiveTransfer(id, body?.items || [], orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Stock received into destination warehouse', data: result };
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Get all stock transfers' })
  async getTransfers(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.getTransfers(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Adjustments
  @Post('adjustments')
  @ApiOperation({ summary: 'Record physical stock count variance adjustment' })
  async createAdjustment(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.inventoryOpsService.createAdjustment(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Patch('adjustments/:id/approve')
  @ApiOperation({ summary: 'Approve and execute physical stock adjustment' })
  async approveAdjustment(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.inventoryOpsService.approveAdjustment(id, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Stock adjustment approved and stock reconciled', data: result };
  }

  @Get('adjustments')
  @ApiOperation({ summary: 'Get all stock adjustments' })
  async getAdjustments(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.getAdjustments(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Batches & Expiry
  @Post('batches')
  @ApiOperation({ summary: 'Create product batch with expiry date' })
  async createBatch(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.createBatch(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('reports/expiring-batches')
  @ApiOperation({ summary: 'Get report of expiring product batches' })
  async getExpiringBatches(@Query('days') days: number, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.getExpiringBatchesReport(orgId, days || 90);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Alerts & Valuation
  @Get('reports/low-stock')
  @ApiOperation({ summary: 'Get low stock alerts based on reorder thresholds' })
  async getLowStockAlerts(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.getLowStockAlerts(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('reports/valuation')
  @ApiOperation({ summary: 'Get warehouse inventory valuation report' })
  async getValuation(@Query('warehouseId') warehouseId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.inventoryOpsService.getInventoryValuation(orgId, warehouseId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
