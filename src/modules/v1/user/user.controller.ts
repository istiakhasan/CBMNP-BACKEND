import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, Query, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { Users } from './entities/user.entity';

@Controller('v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
 async create(@Body() createUserDto: Users,@Req() req:Request) {
    const organizationId=req.headers['x-organization-id']
    const result=await this.userService.create({...createUserDto,organizationId});
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'User create successfully',
      data:result
   }
  }

  @Get()
  async findAll(@Query() query,@Req() req:Request) {
    const organizationId=req.headers['x-organization-id']
    const options = {};
    const keys = ['limit', 'page', 'sortBy', 'sortOrder'];
    for (const key of keys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        options[key] = query[key];
      }
    }
    const searchFilterOptions = {};
    const filterKeys = ['searchTerm', 'employmentStatus', 'role'];
    for (const key of filterKeys) {
      if (query && Object.hasOwnProperty.call(query, key)) {
        searchFilterOptions[key] = query[key];
      }
    }
    const result:any=await this.userService.findAll(   options,
      searchFilterOptions,organizationId);
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'User retrived successfully',
      data:result?.data,
      meta: {
        page: result?.page,
        limit: result?.limit,
        total: result?.total
      }
   }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: Users) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
