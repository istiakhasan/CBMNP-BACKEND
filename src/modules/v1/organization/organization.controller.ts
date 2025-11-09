import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, Req, Query } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { Organization } from './entities/organization.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Organizations')
@Controller('v1/organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  @ApiResponse({ status: 201, description: 'Organization created', type: Organization })
  create(@Body() createOrganizationDto: Organization) {
    return this.organizationService.create(createOrganizationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({ status: 200, description: 'List of organizations', type: [Organization] })
  findAll(@Query() query,@Req() req:Request) {
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
    return this.organizationService.findAll(options,searchFilterOptions);
  }

  @Get('get-by-id')
  @ApiOperation({ summary: 'Get an organization by ID (from headers)' })
  @ApiResponse({ status: 200, description: 'Organization retrieved', type: Organization })
  findOne(@Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    return catchAsync(async (): Promise<IResponse<Organization>> => {
      const result = await this.organizationService.findOne(organizationId as string);
      return {
        message: 'Organization retrieved successfully',
        statusCode: HttpStatus.OK,
        data: result,
        success: true,
      };
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  @ApiResponse({ status: 200, description: 'Organization updated', type: Organization })
  update(@Param('id') id: string, @Body() updateOrganizationDto: Organization) {
    return this.organizationService.update(+id, updateOrganizationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an organization' })
  @ApiResponse({ status: 200, description: 'Organization removed' })
  remove(@Param('id') id: string) {
    return this.organizationService.remove(+id);
  }
}
