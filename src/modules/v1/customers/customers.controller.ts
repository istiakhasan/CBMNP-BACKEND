import { Body, Controller, Get, HttpStatus, Post, Query } from "@nestjs/common";
import { CustomerService } from "./customers.service";
import { ZodPipe } from "src/middleware/zodPipe";
import { CreateCustomerSchema } from "./customer.validation";

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
    @Get('/get-all')
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
        message:"Customer create successfully",
        data:result
      }
      
    }
   
  }