import { Body, Controller, Get, HttpStatus, Post, Query } from "@nestjs/common";
import { ZodPipe } from "src/middleware/zodPipe";
import { StatusService } from "./status.service";
import { CreateStatusSchema } from "./status.validation";

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
    async getAllStatus() {

      const result=await this.statusService.getAllStatus();
      return {
        success:true,
        statusCode:HttpStatus.OK,
        message:"Status retrieved  successfully",
        data:result
      }

    }
   
  }