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
import { FinanceService } from './finance.service';
import { Request } from 'express';

@ApiTags('Finance')
@Controller('v1/finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // Bank Accounts
  @Post('bank-accounts')
  @ApiOperation({ summary: 'Register a new Bank, Cash, or MFS account' })
  async createBankAccount(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.createBankAccount(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('bank-accounts')
  @ApiOperation({ summary: 'Get all Bank, Cash, and MFS accounts' })
  async getBankAccounts(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.getBankAccounts(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Expense Categories
  @Post('expense-categories')
  @ApiOperation({ summary: 'Create an expense category' })
  async createExpenseCategory(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.createExpenseCategory(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('expense-categories')
  @ApiOperation({ summary: 'Get all expense categories' })
  async getExpenseCategories(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.getExpenseCategories(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Expenses
  @Post('expenses')
  @ApiOperation({ summary: 'Record a business expense' })
  async createExpense(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.financeService.createExpense(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Expense recorded successfully', data: result };
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Get paginated list of expenses' })
  async getExpenses(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('categoryId') categoryId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('status') status: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.getExpenses(
      { page, limit, categoryId, startDate, endDate, status },
      orgId,
    );
    return { success: true, statusCode: HttpStatus.OK, data: result.data, meta: { total: result.total, page: result.page, limit: result.limit } };
  }

  // Fund Transfers
  @Post('fund-transfers')
  @ApiOperation({ summary: 'Transfer money between Bank, Cash, and MFS accounts' })
  async transferFunds(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.financeService.transferFunds(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Funds transferred successfully', data: result };
  }

  // Accounts Receivable (AR)
  @Get('receivables/customer-ledger/:customerId')
  @ApiOperation({ summary: 'Get customer ledger statement' })
  async getCustomerLedger(
    @Param('customerId') customerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.getCustomerLedger(customerId, orgId, startDate, endDate);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('receivables/aging-report')
  @ApiOperation({ summary: 'Get Customer Aging Report (0-30, 31-60, 61-90, 90+ days)' })
  async getCustomerAgingReport(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.getCustomerAgingReport(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Accounts Payable (AP)
  @Post('payables/supplier-bills')
  @ApiOperation({ summary: 'Record a supplier bill' })
  async createSupplierBill(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.financeService.createSupplierBill(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('payables/supplier-bills')
  @ApiOperation({ summary: 'Get supplier bills' })
  async getSupplierBills(@Query('supplierId') supplierId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.getSupplierBills(orgId, supplierId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('payables/supplier-payments')
  @ApiOperation({ summary: 'Record a payment to a supplier' })
  async recordSupplierPayment(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.financeService.recordSupplierPayment(data, orgId, userId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Supplier payment recorded', data: result };
  }

  @Get('payables/supplier-ledger/:supplierId')
  @ApiOperation({ summary: 'Get supplier ledger statement' })
  async getSupplierLedger(@Param('supplierId') supplierId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.getSupplierLedger(supplierId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Bank Reconciliation
  @Post('reconciliation/statements')
  @ApiOperation({ summary: 'Upload/create bank statement for reconciliation' })
  async createBankStatement(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.createBankStatement(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Patch('reconciliation/items/:itemId/match')
  @ApiOperation({ summary: 'Match a statement transaction item' })
  async matchStatementItem(
    @Param('itemId') itemId: string,
    @Body() matchData: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.financeService.matchStatementItem(itemId, orgId, matchData);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
