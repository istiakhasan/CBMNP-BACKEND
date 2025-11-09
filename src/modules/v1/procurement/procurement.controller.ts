import { Controller, Post, Get, Body, Param, Req, HttpStatus, Query, Patch } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { CreateProcurementDto } from './dto/create-procurement.dto';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from '../../../util/sendResponse';
import { Procurement } from './entities/procurement.entity';
import { extractOptions } from '../../../helpers/queryHelper';

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
       const filterOptions = extractOptions(query, ['status']);
       const result=await this.procurementService.getAllProcurements( paginationOptions,organizationId as string,filterOptions);
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
  @Get('/reports')
 async getReports(@Req() req:Request,@Query() query) {
    const organizationId=req.headers['x-organization-id']
    return catchAsync(async (): Promise<IResponse<any>> => {
      console.log(query,"query");
       const filterOptions = extractOptions(query, ['status','startDate','endDate']);
       const result=await this.procurementService.getReports( organizationId as string,filterOptions);
      return {
        success: true,
        message: 'Procurement retrieved successfully',
        statusCode: HttpStatus.OK,
        data: result?.data,
      };
    });
    
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.procurementService.getProcurementById(id);
  }

  @Patch('/receive-order')
  async receiveOrder(@Body() payload:any,@Req() req:Request){
    const organizationId=req.headers['x-organization-id']
    return catchAsync(async()=>{
      const result= await this.procurementService.receiveOrder(payload,organizationId)
      return {
        success: true,
        message: 'Order receive  successfully',
        statusCode: HttpStatus.OK,
        data: result,
        
      };
    })
  }
  @Patch('/bulk-update')
  async bulkUpdate(@Body() payload:any){
    return catchAsync(async()=>{
      const result= await this.procurementService.bulkUpdate(payload)
      return {
        success: true,
        message: 'Status update  successfully',
        statusCode: HttpStatus.OK,
        data: result,
        
      };
    })
  }
}
