import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  Req,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PurchaseReturnsService } from './purchase-returns.service';
import { Request } from 'express';

@ApiTags('Purchase Operations & Returns')
@Controller('v1/purchase-returns')
export class PurchaseReturnsController {
  constructor(private readonly prService: PurchaseReturnsService) {}

  // Returns & Debit Notes
  @Post('returns')
  @ApiOperation({ summary: 'Create purchase return to supplier' })
  async createReturn(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.prService.createReturn(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Patch('returns/:id/approve')
  @ApiOperation({ summary: 'Approve purchase return and generate debit note' })
  async approveReturn(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.prService.approveReturn(id, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Purchase return approved and Debit Note issued', data: result };
  }

  @Get('returns')
  @ApiOperation({ summary: 'Get all purchase returns' })
  async getReturns(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.prService.getReturns(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // GRN with QA
  @Post('grn')
  @ApiOperation({ summary: 'Create Goods Receipt Note with Quality Inspection' })
  async createGRN(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.prService.createGRN(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'GRN inspection processed and stock updated', data: result };
  }

  @Get('grn')
  @ApiOperation({ summary: 'Get all Goods Receipt Notes' })
  async getGRNs(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.prService.getGRNs(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // RFQ
  @Post('rfq')
  @ApiOperation({ summary: 'Create Request for Quotation (RFQ)' })
  async createRFQ(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.prService.createRFQ(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('rfq')
  @ApiOperation({ summary: 'Get all RFQs' })
  async getRFQs(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.prService.getRFQs(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('rfq/quotations')
  @ApiOperation({ summary: 'Submit supplier quote for RFQ' })
  async submitQuotation(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.prService.submitSupplierQuotation(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('rfq/:id/compare')
  @ApiOperation({ summary: 'Compare supplier quotations for RFQ' })
  async compareRFQ(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.prService.getRFQComparison(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
