import { Body, Controller, Get, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { CustomerService } from "./customers.service";

import { CreateCustomerSchema } from "./customer.validation";
import { catchAsync } from "../../../hoc/createAsync";
import { ZodPipe } from "../../../middleware/ZodPipe";

@Controller('v1/customers')
export class CustomerController {
    constructor(private readonly customerService: CustomerService) {}
    @Post()
    async createEmployee(@Body(new ZodPipe(CreateCustomerSchema)) data) {
      const result=await this.customerService.createCustomer(data);
      return {
        success:true,
        statusCode:HttpStatus.OK,
        message:"Customer create successfully",
        data:result
      }
      
    }
    @Get()
    async getAllCustomers(@Query() query) {
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
      const result=await this.customerService.getAllCustomers(options,
        searchFilterOptions,);
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
   
  }