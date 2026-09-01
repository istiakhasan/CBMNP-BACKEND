import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountService } from '../services/account.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { Request } from 'express';

@ApiTags('Accounting - Chart of Accounts')
@Controller('v1/accounting/accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ledger account' })
  async create(@Body() createAccountDto: CreateAccountDto, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.accountService.create(createAccountDto, organizationId);
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      message: 'Account created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get flat list of all accounts' })
  async findAll(@Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.accountService.findAll(organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Accounts retrieved successfully',
      data: result,
    };
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get hierarchical Chart of Accounts tree with live balances' })
  async getTree(@Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.accountService.getAccountsTree(organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Chart of Accounts tree retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.accountService.findOne(id, organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Account retrieved successfully',
      data: result,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account' })
  async update(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @Req() req: Request,
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.accountService.update(id, updateAccountDto, organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Account updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete account' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.accountService.remove(id, organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }
}
