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
import { SalesOperationsService } from './sales-operations.service';
import { Request } from 'express';

@ApiTags('Sales Operations & POS Sessions')
@Controller('v1/sales-operations')
export class SalesOperationsController {
  constructor(private readonly salesOpsService: SalesOperationsService) {}

  // Quotations
  @Post('quotations')
  @ApiOperation({ summary: 'Create price quotation' })
  async createQuotation(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.salesOpsService.createQuotation(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Patch('quotations/:id/convert-to-order')
  @ApiOperation({ summary: 'Convert approved quotation into a live Sales Order' })
  async convertToOrder(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.salesOpsService.convertQuotationToOrder(id, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('quotations')
  @ApiOperation({ summary: 'Get all quotations' })
  async getQuotations(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.salesOpsService.getQuotations(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Coupons
  @Post('coupons')
  @ApiOperation({ summary: 'Create promo discount coupon' })
  async createCoupon(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.salesOpsService.createCoupon(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate coupon code against order subtotal' })
  async validateCoupon(@Body() body: { code: string; orderAmount: number; customerId: string }, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.salesOpsService.validateCoupon(body.code, body.orderAmount, body.customerId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Customer Credit
  @Post('customer-credit')
  @ApiOperation({ summary: 'Set customer credit limit & rules' })
  async setCreditLimit(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.salesOpsService.setCreditLimit(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('customer-credit/:customerId')
  @ApiOperation({ summary: 'Check customer credit limit and outstanding status' })
  async checkCustomerCredit(@Param('customerId') customerId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.salesOpsService.checkCustomerCredit(customerId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // POS Sessions
  @Post('pos-sessions/open')
  @ApiOperation({ summary: 'Open a POS register shift' })
  async openSession(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const cashierId = (req as any).user?.userId || (req as any).user?.id || 'cashier-1';
    const result = await this.salesOpsService.openPosSession(data, orgId, cashierId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'POS register shift opened', data: result };
  }

  @Post('pos-sessions/cash-movement')
  @ApiOperation({ summary: 'Record Cash In or Cash Out in register drawer' })
  async cashMovement(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.salesOpsService.recordCashMovement(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Cash movement recorded', data: result };
  }

  @Patch('pos-sessions/:id/close')
  @ApiOperation({ summary: 'Close POS shift with counted cash variance' })
  async closeSession(
    @Param('id') id: string,
    @Body() body: { actualClosingCash: number; closingNotes: string },
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.salesOpsService.closePosSession(id, body.actualClosingCash, body.closingNotes, orgId);
    return { success: true, statusCode: HttpStatus.OK, message: 'POS register shift closed & reconciled', data: result };
  }

  @Get('pos-sessions')
  @ApiOperation({ summary: 'Get all POS register shifts' })
  async getSessions(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.salesOpsService.getPosSessions(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
