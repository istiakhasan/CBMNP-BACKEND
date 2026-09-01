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
import { JournalService } from '../services/journal.service';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { JournalEntryStatus } from '../entities/journal-entry.entity';
import { Request } from 'express';

@ApiTags('Accounting - Journal Entries')
@Controller('v1/accounting/journal-entries')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  @ApiOperation({ summary: 'Post a double-entry journal voucher' })
  async create(
    @Body() createJournalDto: CreateJournalEntryDto,
    @Req() req: Request,
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.journalService.create(
      createJournalDto,
      organizationId,
      userId,
    );
    return {
      success: true,
      statusCode: HttpStatus.CREATED,
      message: 'Journal entry posted successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of journal vouchers' })
  async findAll(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('searchTerm') searchTerm: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('status') status: JournalEntryStatus,
    @Req() req: Request,
  ) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.journalService.findAll(
      { page, limit, searchTerm, startDate, endDate, status },
      organizationId,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Journal entries retrieved successfully',
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal voucher details with debit/credit lines' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const result = await this.journalService.findOne(id, organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Journal entry retrieved successfully',
      data: result,
    };
  }

  @Patch(':id/void')
  @ApiOperation({ summary: 'Void a posted journal entry' })
  async voidEntry(@Param('id') id: string, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.journalService.void(id, organizationId, userId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Journal entry voided successfully',
      data: result,
    };
  }
}
