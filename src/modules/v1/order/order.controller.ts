import { Controller, Get, Post, Param, Body, HttpStatus, Query, Patch } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { catchAsync } from 'src/hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';

@Controller('v1/orders')
export class OrderController {  
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() payload: any): Promise<Order> {
    return await this.orderService.createOrder(payload);
  }

  @Get()
  async getOrders(@Query() query){
    const options = {};
    const keys = ['limit', 'page', 'sortBy', 'sortOrder'];
    for (const key of keys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        options[key] = query[key];
      }
    }
    const searchFilterOptions = {};
    const filterKeys = ['searchTerm', 'statusId'];
    for (const key of filterKeys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        searchFilterOptions[key] = query[key];
      }
    }
    const result= await this.orderService.getOrders(options,searchFilterOptions);
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'Order retrieved successfully',
      data:result?.data,
      meta: {
        page: result?.page,
        limit: result?.limit,
        total: result?.total
      }
   }
  }
  @Get(':id')
  async getOrderById(@Param('id') id: number): Promise<Order> {
    return await this.orderService.getOrderById(id);
  }
  @Patch(':id')
  async update(@Param('id') id: number,@Body() data:Order){
    return  catchAsync(async():Promise<IResponse<Order>>=>{
      const result=await this.orderService.update(id,data);
      return {
        message:'Order update successfully',
        statusCode:HttpStatus.OK,
        data:result,
        success:true
      }
    })
  }
}
