import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, Query, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { Users } from './entities/user.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: Users })
  async create(@Body() createUserDto: Users, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    const result = await this.userService.create({ ...createUserDto, organizationId });
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'User created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with filters' })
  @ApiResponse({ status: 200, description: 'List of users', type: [Users] })
  async findAll(@Query() query, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
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
    const result: any = await this.userService.findAll(options, searchFilterOptions, organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Users retrieved successfully',
      data: result?.data,
      meta: {
        page: result?.page,
        limit: result?.limit,
        total: result?.total,
      },
    };
  }

  @Get('/options')
  @ApiOperation({ summary: 'Get all user options (dropdown)' })
  @ApiResponse({ status: 200, description: 'List of user options', type: [Users] })
  async findAllUserOptions(@Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    const result: any = await this.userService.findAllUserOptions(organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'User options retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully', type: Users })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated successfully', type: Users })
  async update(@Param('id') id: number, @Body() updateUserDto: Users, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    const result = await this.userService.update(id, { ...updateUserDto, organizationId });
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'User updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
