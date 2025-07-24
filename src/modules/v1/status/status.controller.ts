import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ZodPipe } from '../../../middleware/ZodPipe';
import { StatusService } from './status.service';
import { CreateStatusSchema } from './status.validation';
import { catchAsync } from '../../../hoc/createAsync';
import { OrderStatus } from './entities/status.entity';
import { IResponse } from 'src/util/sendResponse';
import { Request } from 'express';

@Controller('v1/status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}
  @Post()
  async createStatus(@Body(new ZodPipe(CreateStatusSchema)) data) {
    const result = await this.statusService.createStatus(data);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Status create successfully',
      data: result,
    };
  }
  @Get()
  async getAllStatus(@Query() query: { label: string }) {
    return catchAsync(async (): Promise<IResponse<OrderStatus[]>> => {
      const result = await this.statusService.getAllStatus(query);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Status retrieved  successfully',
        data: result,
      };
    });
  }
  @Get('/orders-count')
  async getAllOrdersCountByStatus(@Req() req: Request, @Query() query) {
    const organizationId = req.headers['x-organization-id'];
    const searchFilterOptions: Record<string, any> = {};

    const filterKeys = [
      'searchTerm',
      'statusId',
      'locationId',
      'startDate',
      'endDate',
      'currier',
    ];
    for (const key of filterKeys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        // Ensure array-like query params are treated as arrays
        if (Array.isArray(query[key])) {
          searchFilterOptions[key] = query[key];
        } else if (key === 'statusId' || key === 'currier') {
          searchFilterOptions[key] = [query[key]];
        } else {
          searchFilterOptions[key] = query[key];
        }
      }
    }

    const result = await this.statusService.getAllOrdersCountByStatus(
      organizationId as string,
      searchFilterOptions,
    );

    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Status retrieved successfully',
      data: result,
    };
  }
}
