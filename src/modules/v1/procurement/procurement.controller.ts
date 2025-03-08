import { Controller, Post, Get, Body, Param, Req, HttpStatus, Query } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { CreateProcurementDto } from './dto/create-procurement.dto';
import { catchAsync } from 'src/hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { Procurement } from './entities/procurement.entity';
import { extractOptions } from 'src/helpers/queryHelper';

@Controller('v1/procurements')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Post()
  create(@Body() createProcurementDto:Partial<CreateProcurementDto>,@Req() req:Request) {
        const organizationId=req.headers['x-organization-id']
          return catchAsync(async (): Promise<IResponse<Procurement>> => {
            const result = await this.procurementService.createProcurement({...createProcurementDto,organizationId});
            return {
              success: true,
              message: 'Procurement created successfully',
              statusCode: HttpStatus.OK,
              data: result,
            };
          });
  }

  @Get()
 async findAll(@Req() req:Request,@Query() query) {
    const organizationId=req.headers['x-organization-id']
    return catchAsync(async (): Promise<IResponse<any>> => {
       const paginationOptions = extractOptions(query, ['limit', 'page', 'sortBy', 'sortOrder']);
       const result=await this.procurementService.getAllProcurements( paginationOptions,organizationId as string);
      return {
        success: true,
        message: 'Procurement retrieved successfully',
        statusCode: HttpStatus.OK,
        data: result?.data,
        meta: {
          page: result?.page,
          limit: result?.limit,
          total: result?.total
        }
      };
    });
    
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.procurementService.getProcurementById(id);
  }
}
