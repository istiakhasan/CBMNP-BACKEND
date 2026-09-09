import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { GarmentsService } from './garments.service';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from '../../../util/sendResponse';

@Controller('v1/garments')
export class GarmentsController {
  constructor(private readonly garmentsService: GarmentsService) {}

  // =========================================================================
  // DASHBOARD
  // =========================================================================
  @Get('dashboard')
  async getDashboard(@Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const data = await this.garmentsService.getDashboardMetrics(organizationId);
      return { success: true, statusCode: HttpStatus.OK, message: 'Metrics retrieved', data };
    });
  }

  // =========================================================================
  // BUYER ORDERS
  // =========================================================================
  @Post('orders')
  async createOrder(@Body() dto: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const data = await this.garmentsService.createOrder(dto, organizationId);
      return { success: true, statusCode: HttpStatus.CREATED, message: 'Order created', data };
    });
  }

  @Get('orders')
  async getOrders(@Query() query: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };
      const filterOptions = { searchTerm: query.searchTerm, orderType: query.orderType };
      const result = await this.garmentsService.getOrders(options, filterOptions, organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Orders retrieved',
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    });
  }

  @Get('orders/all')
  async getAllOrdersList(@Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const data = await this.garmentsService.getAllOrdersList(organizationId);
      return { success: true, statusCode: HttpStatus.OK, message: 'Orders list retrieved', data };
    });
  }

  @Get('orders/:id')
  async getOrderById(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.getOrderById(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'Order retrieved', data };
    });
  }

  @Patch('orders/:id')
  async updateOrder(@Param('id') id: string, @Body() dto: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.updateOrder(id, dto);
      return { success: true, statusCode: HttpStatus.OK, message: 'Order updated', data };
    });
  }

  @Delete('orders/:id')
  async deleteOrder(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.deleteOrder(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'Order deleted', data };
    });
  }

  // =========================================================================
  // BOM (BILL OF MATERIALS)
  // =========================================================================
  @Post('boms')
  async createBom(@Body() dto: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const data = await this.garmentsService.createBom(dto, organizationId);
      return { success: true, statusCode: HttpStatus.CREATED, message: 'BOM created', data };
    });
  }

  @Get('boms')
  async getBoms(@Query() query: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };
      const filterOptions = { orderId: query.orderId };
      const result = await this.garmentsService.getBoms(options, filterOptions, organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'BOMs retrieved',
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    });
  }

  @Get('boms/all')
  async getAllBomsList(@Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const data = await this.garmentsService.getAllBomsList(organizationId);
      return { success: true, statusCode: HttpStatus.OK, message: 'BOMs list retrieved', data };
    });
  }

  @Get('boms/:id')
  async getBomById(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.getBomById(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'BOM retrieved', data };
    });
  }

  @Patch('boms/:id')
  async updateBom(@Param('id') id: string, @Body() dto: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.updateBom(id, dto);
      return { success: true, statusCode: HttpStatus.OK, message: 'BOM updated', data };
    });
  }

  @Patch('boms/:id/approve')
  async approveBom(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.approveBom(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'BOM approved successfully', data };
    });
  }

  @Delete('boms/:id')
  async deleteBom(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.deleteBom(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'BOM deleted', data };
    });
  }

  // =========================================================================
  // PURCHASE ORDERS (PO)
  // =========================================================================
  @Post('pos')
  async createPo(@Body() dto: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const userName = req.user?.fullName || req.user?.name || dto.createdBy || 'Admin';
      const data = await this.garmentsService.createPo(dto, userName, organizationId);
      return { success: true, statusCode: HttpStatus.CREATED, message: 'PO created', data };
    });
  }

  @Get('pos')
  async getPos(@Query() query: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };
      const filterOptions = { status: query.status };
      const result = await this.garmentsService.getPos(options, filterOptions, organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'POs retrieved',
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    });
  }

  @Get('pos/all')
  async getAllPosList(@Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const data = await this.garmentsService.getAllPosList(organizationId);
      return { success: true, statusCode: HttpStatus.OK, message: 'POs list retrieved', data };
    });
  }

  @Get('pos/:id')
  async getPoById(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.getPoById(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'PO retrieved', data };
    });
  }

  @Patch('pos/:id')
  async updatePo(@Param('id') id: string, @Body() dto: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.updatePo(id, dto);
      return { success: true, statusCode: HttpStatus.OK, message: 'PO updated', data };
    });
  }

  @Patch('pos/:id/submit-check')
  async submitCheck(@Param('id') id: string, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const userName = req.user?.fullName || req.user?.name || 'Admin';
      const data = await this.garmentsService.submitCheck(id, userName);
      return { success: true, statusCode: HttpStatus.OK, message: 'PO submitted for checking', data };
    });
  }

  @Patch('pos/:id/decide-check')
  async decideCheck(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const userName = req.user?.fullName || req.user?.name || 'Checker';
      const data = await this.garmentsService.decideCheck(id, body.decision, body.note, userName);
      return { success: true, statusCode: HttpStatus.OK, message: `PO check ${body.decision}`, data };
    });
  }

  @Patch('pos/:id/decide-approval')
  async decideApproval(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const userName = req.user?.fullName || req.user?.name || 'Approver';
      const data = await this.garmentsService.decideApproval(id, body.decision, body.note, userName);
      return { success: true, statusCode: HttpStatus.OK, message: `PO approval ${body.decision}`, data };
    });
  }

  @Delete('pos/:id')
  async deletePo(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.deletePo(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'PO deleted', data };
    });
  }

  @Post('pos/receive')
  async receivePo(@Body() dto: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const userName = req.user?.fullName || req.user?.name || 'Store Keeper';
      const data = await this.garmentsService.receivePoItems(dto, userName, organizationId);
      return { success: true, statusCode: HttpStatus.OK, message: 'PO goods received into inventory', data };
    });
  }

  @Get('pos/:id/receiving-progress')
  async getReceivingProgress(@Param('id') id: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.getReceivingProgress(id);
      return { success: true, statusCode: HttpStatus.OK, message: 'Receiving progress retrieved', data };
    });
  }

  // =========================================================================
  // INVENTORY & ADJUSTMENTS
  // =========================================================================
  @Get('inventory')
  async getInventory(@Query() query: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };
      const filterOptions = { category: query.category, search: query.search };
      const result = await this.garmentsService.getInventory(options, filterOptions, organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Inventory retrieved',
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    });
  }

  @Get('inventory/catalog')
  async getInventoryCatalog(@Query('search') search: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.getInventoryCatalog(search);
      return { success: true, statusCode: HttpStatus.OK, message: 'Catalog retrieved', data };
    });
  }

  @Get('inventory/lots-for-item')
  async getLotsForItem(@Query('category') category: string, @Query('name') name: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.getLotsForItem(category, name);
      return { success: true, statusCode: HttpStatus.OK, message: 'Lots retrieved', data };
    });
  }

  @Post('inventory/direct-stock-in')
  async directStockIn(@Body() dto: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const userName = req.user?.fullName || req.user?.name || 'Merchandiser';
      const data = await this.garmentsService.directStockIn(dto, userName, organizationId);
      return { success: true, statusCode: HttpStatus.CREATED, message: 'Sample material stock-in successful', data };
    });
  }

  @Get('inventory/sample-inwards')
  async getSampleInwards(@Query() query: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };
      const filterOptions = {
        approvalStatus: query.approvalStatus,
        sourceType: query.sourceType,
        search: query.search,
      };
      const result = await this.garmentsService.getSampleInwards(options, filterOptions);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Sample inwards retrieved',
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    });
  }

  @Patch('inventory/sample-inwards/:id/decide')
  async decideSampleInward(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const userName = req.user?.fullName || req.user?.name || 'Sample In-Charge';
      const data = await this.garmentsService.decideSampleInwardApproval(id, body.decision, body.note, userName);
      return { success: true, statusCode: HttpStatus.OK, message: `Sample inward ${body.decision}`, data };
    });
  }

  @Post('inventory/adjustments')
  async proposeAdjustment(@Body() dto: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const userName = req.user?.fullName || req.user?.name || 'Admin';
      const data = await this.garmentsService.proposeAdjustment(dto, userName, organizationId);
      return { success: true, statusCode: HttpStatus.CREATED, message: 'Adjustment proposed', data };
    });
  }

  @Get('inventory/adjustments')
  async getAdjustments(@Query() query: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };
      const result = await this.garmentsService.getAdjustments(options, organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Adjustments retrieved',
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    });
  }

  @Get('inventory/adjustments/pending')
  async getPendingAdjustments(@Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const data = await this.garmentsService.getPendingAdjustments(organizationId);
      return { success: true, statusCode: HttpStatus.OK, message: 'Pending adjustments retrieved', data };
    });
  }

  @Patch('inventory/adjustments/:id/decide')
  async decideAdjustment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const userName = req.user?.fullName || req.user?.name || 'Admin';
      const data = await this.garmentsService.decideAdjustment(id, body.decision, body.note, userName);
      return { success: true, statusCode: HttpStatus.OK, message: `Adjustment ${body.decision}`, data };
    });
  }

  // =========================================================================
  // MATERIAL FLOOR ISSUE & RETURNS
  // =========================================================================
  @Post('material-issues')
  async createMaterialIssue(@Body() dto: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const userName = req.user?.fullName || req.user?.name || 'Store Keeper';
      const data = await this.garmentsService.createMaterialIssue(dto, userName, organizationId);
      return { success: true, statusCode: HttpStatus.CREATED, message: 'Material issued to floor', data };
    });
  }

  @Post('material-issues/return')
  async createMaterialReturn(@Body() dto: any, @Req() req: any) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const userName = req.user?.fullName || req.user?.name || 'Store Keeper';
      const data = await this.garmentsService.createMaterialReturn(dto, userName, organizationId);
      return { success: true, statusCode: HttpStatus.CREATED, message: 'Material returned to store', data };
    });
  }

  @Get('material-issues')
  async getMaterialIssues(@Query() query: any, @Req() req: Request) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const organizationId = req.headers['x-organization-id'] as string;
      const options = {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };
      const filterOptions = { bomId: query.bomId, type: query.type };
      const result = await this.garmentsService.getMaterialIssues(options, filterOptions, organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Material issues retrieved',
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total },
      };
    });
  }

  @Get('material-issues/summary')
  async getMaterialSummaryByBom(@Query('bomId') bomId: string) {
    return catchAsync(async (): Promise<IResponse<any>> => {
      const data = await this.garmentsService.getMaterialSummaryByBom(bomId);
      return { success: true, statusCode: HttpStatus.OK, message: 'Material BOM summary retrieved', data };
    });
  }
}
