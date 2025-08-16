import { Controller, Get, Post, Param, Body, HttpStatus, Query, Patch, Req } from '@nestjs/common';
import {  OrderServiceV2 } from './order.service';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { Request } from 'express';
import { Order } from 'src/modules/v1/order/entities/order.entity';
@Controller('v2/orders')
export class OrderControllerv2 {  
  constructor(private readonly orderService: OrderServiceV2) {}
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
}
