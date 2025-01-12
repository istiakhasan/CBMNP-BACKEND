import { Controller, Post, Body, HttpStatus, Get, Query, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { catchAsync } from 'src/hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { Inventory } from './entities/inventory.entity';
import { InventoryItem } from './entities/inventoryitem.entity';

@Controller('v1/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  create(@Body() createInventoryDto: CreateInventoryDto & {type:boolean}) {
       return catchAsync(async ():Promise<IResponse<Inventory>> => {
          const result = await this.inventoryService.addProductToInventory(createInventoryDto);
          return {
            success: true,
            message: 'stock update successfully',
            statusCode: HttpStatus.OK,
            data: result,
          };
        });
  }
  @Get()
  loadStock() {
       return catchAsync(async ():Promise<IResponse<Inventory[]>> => {
          const result = await this.inventoryService.loadInventory();
          return {
            success: true,
            message: 'stock update successfully',
            statusCode: HttpStatus.OK,
            data: result,
          };
        });
  }
  @Get('/getbywarehouseproduct')
  loadStockByWarehouseAndProduct(@Query() query) {
       return catchAsync(async ():Promise<IResponse<InventoryItem>> => {
          const result = await this.inventoryService.loadInventoryByWarehouseProduct(query);
          return {
            success: true,
            message: 'stock update successfully',
            statusCode: HttpStatus.OK,
            data: result,
          };
        });
  }
  @Get('/:productId')
  loadStockByProductId(@Param('productId') productId:string) {
       return catchAsync(async ():Promise<IResponse<Inventory>> => {
          const result = await this.inventoryService.loadInventoryByProductId(productId);
          return {
            success: true,
            message: 'stock update successfully',
            statusCode: HttpStatus.OK,
            data: result,
          };
        });
  }
}
