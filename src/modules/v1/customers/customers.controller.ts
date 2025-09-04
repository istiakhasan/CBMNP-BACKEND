import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { CustomerService } from "./customers.service";

import { CreateCustomerSchema } from "./customer.validation";
import { catchAsync } from "../../../hoc/createAsync";
import { ZodPipe } from "../../../middleware/ZodPipe";
import { Request } from "express";
import { Customers } from "./entities/customers.entity";

@Controller('v1/customers')
export class CustomerController {
    constructor(private readonly customerService: CustomerService) {}
    @Post()
    async createEmployee(@Body(new ZodPipe(CreateCustomerSchema)) data,@Req() req:Request) {
      const organizationId=req.headers['x-organization-id']
      const result=await this.customerService.createCustomer({...data,organizationId});
      return {
        success:true,
        statusCode:HttpStatus.OK,
        message:"Customer create successfully",
        data:result
      }
      
    }
    @Get()
    async getAllCustomers(@Query() query,@Req() req:Request) {
      const options = {};
      const keys = ['limit', 'page', 'sortBy', 'sortOrder'];
      for (const key of keys) {
        if (query && Object.hasOwnProperty.call(query, key)) {
          options[key] = query[key];
        }
      }
      const searchFilterOptions = {};
      const filterKeys = ['searchTerm', 'filterByCustomerType'];
      for (const key of filterKeys) {
        if (query && Object.hasOwnProperty.call(query, key)) {
          searchFilterOptions[key] = query[key];
        }
      }
       const organizationId=req.headers['x-organization-id']
      const result=await this.customerService.getAllCustomers(options,
        searchFilterOptions,organizationId);
        return {
          success:true,
          statusCode:HttpStatus.OK,
          message:'Customers retrieved successfully',
          data:result?.data,
          meta: {
            page: result?.page,
            limit: result?.limit,
            total: result?.total
          }
       }
      
    }
    @Get('retention-reports')
    async getCustomerRetentionReports(@Query() query,@Req() req:Request) {
      const options = {};
      const keys = ['limit', 'page', 'sortBy', 'sortOrder'];
      for (const key of keys) {
        if (query && Object.hasOwnProperty.call(query, key)) {
          options[key] = query[key];
        }
      }
      const searchFilterOptions = {};
      const filterKeys = ['searchTerm', 'filterByCustomerType','startDate','endDate','currier'];
      for (const key of filterKeys) {
        if (query && Object.hasOwnProperty.call(query, key)) {
          searchFilterOptions[key] = query[key];
        }
      }
       const organizationId=req.headers['x-organization-id']
      const result=await this.customerService.getCustomerRetentionReports(options,
        searchFilterOptions,organizationId);
        return {
          success:true,
          statusCode:HttpStatus.OK,
          message:'Customers retrieved successfully',
          data:result?.data,
          meta: {
            page: result?.page,
            limit: result?.limit,
            total: result?.total,
            overallTotalOrders:result?.overallTotalOrders,
            overallTotalSpent:result?.overallTotalSpent,
          }
       }
      
    }
    @Get('/orders-count/:id')
    async getOrdersCount(@Param('id') customerId) {
      return catchAsync(async()=>{
        console.log(customerId);
        const result=await this.customerService.getOrdersCount(customerId);
        return {
          success:true,
          statusCode:HttpStatus.OK,
          message:'Customers orders count retrieved successfully',
          data:result
       }
      }) 
    }
    @Get('/:id')
    async getOrderByid(@Param('id') customerId) {
      return catchAsync(async()=>{
        const result=await this.customerService.getOrderByid(customerId);
        return {
          success:true,
          statusCode:HttpStatus.OK,
          message:'Customers  retrieved successfully',
          data:result
       }
      }) 
    }
    @Patch('/:id')
    async updateCustomerById(@Param('id') id:number,@Body() payload:Customers) {
      return catchAsync(async()=>{
        const result=await this.customerService.updateCustomerById(id,payload);
        return {
          success:true,
          statusCode:HttpStatus.OK,
          message:'Customers  update successfully',
          data:result
       }
      }) 
    }
   
  }