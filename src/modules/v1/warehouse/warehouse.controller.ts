import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, Query } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { catchAsync } from 'src/hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { Warehouse } from './entities/warehouse.entity';
import { extractOptions } from 'src/helpers/queryHelper';

@Controller('v1/warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  create(@Body() createWarehouseDto: Warehouse) {
    return catchAsync(async ():Promise<IResponse<Warehouse>> => {
      const result =await this.warehouseService.create(createWarehouseDto);
      return {
        success: true,
        message: 'Warehouse created successfully',
        statusCode: HttpStatus.OK,
        data: result,
      };
    });
  }

  @Get()
 async findAll(@Query() query) {
      return catchAsync(async ():Promise<IResponse<Warehouse[]>> => {
          const paginationOptions = extractOptions(query, ['limit', 'page', 'sortBy', 'sortOrder']);
          const filterOptions = extractOptions(query, ['searchTerm']);
          const result = await this.warehouseService.findAll(paginationOptions, filterOptions);
          return {
            success: true,
            statusCode: HttpStatus.OK,
            message: 'Products retrieved successfully',
            data: result?.data,
            meta: {
              total: result?.total,
              page: result?.page,
              limit: result?.limit,
            },
          };
        });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.warehouseService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWarehouseDto: UpdateWarehouseDto) {
    return this.warehouseService.update(+id, updateWarehouseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.warehouseService.remove(+id);
  }
}
