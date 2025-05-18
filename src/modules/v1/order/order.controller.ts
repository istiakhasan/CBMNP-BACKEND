import { Controller, Get, Post, Param, Body, HttpStatus, Query, Patch, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { PaymentHistory } from './entities/paymentHistory.entity';
import { Request } from 'express';

@Controller('v1/orders')
export class OrderController {  
  constructor(private readonly orderService: OrderService) {}

 

  @Get()
  async getOrders(@Query() query,@Req() req:Request){
    const organizationId=req.headers['x-organization-id']
    const options = {};
    const keys = ['limit', 'page', 'sortBy', 'sortOrder'];
    for (const key of keys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        options[key] = query[key];
      }
    }
    const searchFilterOptions = {};
    const filterKeys = ['searchTerm','statusId','locationId','startDate','endDate','currier'];
    for (const key of filterKeys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        searchFilterOptions[key] = query[key];
      }
    }
    const result= await this.orderService.getOrders(options,searchFilterOptions,organizationId);
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
  @Get('/logs/:id')
  async getOrdersLogs(@Param('id') id:number){


    const result= await this.orderService.getOrdersLogs(id);
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'Order retrieved successfully',
      data:result,
   }
  }
  @Get(':id')
  async getOrderById(@Param('id') id: number): Promise<Order> {
    return await this.orderService.getOrderById(id);
  }
  @Post()
  async createOrder(@Body() payload: any,@Req() req:Request): Promise<Order> {
    const organizationId=req.headers['x-organization-id']
    return await this.orderService.createOrder(payload,organizationId as string);
  }
  @Post('/payment/:id')
  async updatePayment(@Param('id') id: number,@Body() data:PaymentHistory){
    return  catchAsync(async():Promise<IResponse<any>>=>{
      const result=await this.orderService.addPayment(id,data);
      return {
        message:'Order update successfully',
        statusCode:HttpStatus.OK,
        data:result,
        success:true
      }
    })
  }
  @Patch('/change-status')
  async changeStatus(@Body() data:any,@Req() req:Request){
    return  catchAsync(async():Promise<IResponse<Order[]>>=>{
      const {orderIds,...rest}=data
      const organizationId=req.headers['x-organization-id']
      const result=await this.orderService.changeStatusBulk(orderIds,rest,organizationId as string);
      return {
        message:'Order status change  successfully',
        statusCode:HttpStatus.OK,
        data:result,
        success:true
      }
    })
  }
  @Patch('/change-hold-status')
  async changeHoldStatus(@Body() data:any,@Req() req:Request){
    return  catchAsync(async():Promise<IResponse<Order[]>>=>{
      const {orderIds,...rest}=data
      const organizationId=req.headers['x-organization-id']
      const result=await this.orderService.changeHoldStatus(orderIds,rest,organizationId as string);
      return {
        message:'Order status change  successfully',
        statusCode:HttpStatus.OK,
        data:result,
        success:true
      }
    })
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
