import { Controller, Get, Post, Param, Body, HttpStatus, Query, Patch, Req, Res } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { PaymentHistory } from './entities/paymentHistory.entity';
import { Request, Response } from 'express';

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
    const filterKeys = ['searchTerm','statusId','locationId','startDate','endDate','currier','productId'];
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
  @Get('/reports')
  async getOrdersReports(@Query() query,@Req() req:Request){
    const organizationId=req.headers['x-organization-id']
    const options = {};
    const keys = ['limit', 'page', 'sortBy', 'sortOrder'];
    for (const key of keys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        options[key] = query[key];
      }
    }
    const searchFilterOptions = {};
    const filterKeys = ['searchTerm','statusId','locationId','startDate','endDate','currier','productId','agentIds'];
    for (const key of filterKeys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        searchFilterOptions[key] = query[key];
      }
    }
    const result= await this.orderService.getOrdersReports(options,searchFilterOptions,organizationId);
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'Order retrieved successfully',
      data:result?.data,
      meta: {
        total: result?.total,
        page: result?.page,
        limit: result?.limit,
        totalAmount:result?.totalAmount,
        damageQuantity:result?.damageQuantity,
        totalReturnQty:result?.totalReturnQty,
        totalPaidAmount:result?.totalPaidAmount,
      }
   }
  }
@Get('/download-reports')
async downloadReports(@Query() query, @Req() req: Request, @Res() res: Response) {
  const organizationId: any = req.headers['x-organization-id'];

  const searchFilterOptions = {};
  const filterKeys = ['searchTerm','statusId','locationId','startDate','endDate','currier','productId','agentIds'];
  for (const key of filterKeys) {
    if (query && Object.hasOwnProperty.call(query, key)) {
      searchFilterOptions[key] = query[key];
    }
  }

  return this.orderService.downloadOrdersExcel(searchFilterOptions, organizationId, res);
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
  @Post('/pos')
  async createPosOrder(@Body() payload: any,@Req() req:Request): Promise<Order> {
    const organizationId=req.headers['x-organization-id']
    return await this.orderService.createPosOrder(payload,organizationId as string);
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
  @Patch('/return')
  async returnOrders(@Body() data:any,@Req() req:Request){
    return  catchAsync(async():Promise<IResponse<Order[]>>=>{
      const organizationId=req.headers['x-organization-id']
      const result=await this.orderService.returnOrders(data);
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
