import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './entities/supplier.entity';
import { IResponse } from '../../../util/sendResponse';
import { catchAsync } from '../../../hoc/createAsync';

@Controller('v1/supplier')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  create(@Body() createSupplierDto: Supplier, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    return catchAsync(async (): Promise<IResponse<Supplier>> => {
      const result = await this.supplierService.create({
        ...createSupplierDto,
        organizationId,
      });
      return {
        success: true,
        message: 'Supplier created successfully',
        statusCode: HttpStatus.OK,
        data: result,
      };
    });
  }
  @Get('get-all')
  async getOrders(@Query() query, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    const options = {};
    const keys = ['limit', 'page', 'sortBy', 'sortOrder'];
    for (const key of keys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        options[key] = query[key];
      }
    }
    const searchFilterOptions = {};
    const filterKeys = [
      'searchTerm',
      'statusId',
      'locationId',
      'startDate',
      'endDate',
      'currier',
      'productId',
    ];
    for (const key of filterKeys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        searchFilterOptions[key] = query[key];
      }
    }
    const result = await this.supplierService.getAllSupplier(
      options,
      searchFilterOptions,
      organizationId,
    );
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Order retrieved successfully',
      data: result?.data,
      meta: {
        page: result?.page,
        limit: result?.limit,
        total: result?.total,
      },
    };
  }

  @Get('/options')
  async warehouseOptions(@Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    return catchAsync(async (): Promise<IResponse<Supplier[]>> => {
      const result = await this.supplierService.loadOptions(organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Supplier options retrieved successfully',
        data: result,
      };
    });
  }

  @Get()
  findAll() {
    return this.supplierService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return catchAsync(async (): Promise<IResponse<Supplier>> => {
      const result = await this.supplierService.update(id, updateSupplierDto);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Supplier retrieved successfully',
        data: result,
      };
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supplierService.remove(+id);
  }
}
