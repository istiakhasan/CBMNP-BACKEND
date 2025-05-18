import { Body, Controller, Get, HttpStatus, Post, Query, Req } from "@nestjs/common";
import { ZodPipe } from '../../../middleware/ZodPipe'
import { StatusService } from "./status.service";
import { CreateStatusSchema } from "./status.validation";
import { catchAsync } from "../../../hoc/createAsync";
import { OrderStatus } from "./entities/status.entity";
import { IResponse } from "src/util/sendResponse";
import { Request } from "express";

@Controller('v1/status')
export class StatusController {
    constructor(private readonly statusService: StatusService) {}
    @Post()
    async createStatus(@Body(new ZodPipe(CreateStatusSchema)) data) {
      const result=await this.statusService.createStatus(data);
      return {
        success:true,
        statusCode:HttpStatus.OK,
        message:"Status create successfully",
        data:result
      }
      
    }
    @Get()
    async getAllStatus(@Query() query:{label:string}) {
      return  catchAsync(async():Promise<IResponse<OrderStatus[]>>=>{
        const result=await this.statusService.getAllStatus(query);
      return {
        success:true,
        statusCode:HttpStatus.OK,
        message:"Status retrieved  successfully",
        data:result
      }
      })

    }
    @Get('/orders-count')
    async getAllOrdersCountByStatus(@Req() req:Request) {
      const organizationId=req.headers['x-organization-id']
      const result=await this.statusService.getAllOrdersCountByStatus(organizationId);
      return {
        success:true,
        statusCode:HttpStatus.OK,
        message:"Status retrieved  successfully",
        data:result
      }

    }
   
  }