import {
  Controller,
  Get,
  Query,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FinancialReportsService } from '../services/financial-reports.service';
import { FinancialReportQueryDto } from '../dto/financial-report-query.dto';
import { Request } from 'express';

@ApiTags('Accounting - Financial Reports')
@Controller('v1/accounting/reports')
export class FinancialReportsController {
  constructor(
    private readonly financialReportsService: FinancialReportsService,
  ) {}

  @Get('general-ledger')
  @ApiOperation({ summary: 'Get General Ledger account statement' })
  async getGeneralLedger(
    @Query('accountId') accountId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request,
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.financialReportsService.getGeneralLedger(
      accountId,
      organizationId,
      startDate,
      endDate,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'General Ledger report retrieved successfully',
      data: result,
    };
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get Trial Balance report' })
  async getTrialBalance(
    @Query('asOfDate') asOfDate: string,
    @Req() req: Request,
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.financialReportsService.getTrialBalance(
      organizationId,
      asOfDate,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Trial Balance report retrieved successfully',
      data: result,
    };
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Get Multi-Step Profit & Loss (Income Statement)' })
  async getProfitAndLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request,
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.financialReportsService.getProfitAndLoss(
      organizationId,
      startDate,
      endDate,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Profit & Loss report retrieved successfully',
      data: result,
    };
  }

  @Get('balance-sheet')
  @ApiOperation({ summary: 'Get Balance Sheet statement' })
  async getBalanceSheet(
    @Query('asOfDate') asOfDate: string,
    @Req() req: Request,
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.financialReportsService.getBalanceSheet(
      organizationId,
      asOfDate,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Balance Sheet report retrieved successfully',
      data: result,
    };
  }
}
