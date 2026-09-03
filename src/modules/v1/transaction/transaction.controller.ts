import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, Req, Query } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { Transaction } from './entities/transaction.entity';
import { Request } from 'express';

@Controller('v1/transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  create(@Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionService.create(createTransactionDto);
  }

  @Get()
  async findAll(@Req() req:Request, @Query() query: any) {
   return catchAsync(async():Promise<IResponse<{ data: Transaction[]; total: number }>>=>{
     const organizationId=req.headers['x-organization-id']
     const result=await this.transactionService.findAll(organizationId as string, query);
     return {
      success:true,
      message:'Transaction history retrieved successfully',
      statusCode:HttpStatus.OK,
      data:result
     }
 
    })
  }
  @Get('/findById/:id')
  async findByProductId(@Param('id') id:string, @Req() req: Request, @Query() query: any) {
   return catchAsync(async():Promise<IResponse<{ data: Transaction[]; total: number }>>=>{
     const organizationId=req.headers['x-organization-id']
     const result=await this.transactionService.findByProductId(id, organizationId as string, query);
     return {
      success:true,
      message:'Transaction history retrieved successfully',
      statusCode:HttpStatus.OK,
      data:result
     }
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTransactionDto: UpdateTransactionDto) {
    return this.transactionService.update(+id, updateTransactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.transactionService.remove(+id);
  }
}
