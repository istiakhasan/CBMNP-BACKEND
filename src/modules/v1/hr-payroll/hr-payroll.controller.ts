import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  Req,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HrPayrollService } from './hr-payroll.service';
import { Request } from 'express';

@ApiTags('HR & Payroll')
@Controller('v1/hr-payroll')
export class HrPayrollController {
  constructor(private readonly hrPayrollService: HrPayrollService) {}

  // Departments & Designations
  @Post('departments')
  @ApiOperation({ summary: 'Create department' })
  async createDepartment(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createDepartment(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('departments')
  @ApiOperation({ summary: 'Get all departments' })
  async getDepartments(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getDepartments(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('designations')
  @ApiOperation({ summary: 'Create designation' })
  async createDesignation(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createDesignation(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('designations')
  @ApiOperation({ summary: 'Get all designations' })
  async getDesignations(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getDesignations(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Employees
  @Post('employees')
  @ApiOperation({ summary: 'Create employee profile' })
  async createEmployee(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createEmployee(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('employees')
  @ApiOperation({ summary: 'Get all employee profiles' })
  async getEmployees(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getEmployees(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Attendance
  @Post('attendance/clock-in')
  @ApiOperation({ summary: 'Clock-in employee attendance' })
  async clockIn(@Body() body: { employeeId: string }, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.clockIn(body.employeeId, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Clock-in recorded successfully', data: result };
  }

  @Post('attendance/clock-out')
  @ApiOperation({ summary: 'Clock-out employee attendance' })
  async clockOut(@Body() body: { employeeId: string }, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.clockOut(body.employeeId, orgId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Clock-out recorded successfully', data: result };
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Get attendance records' })
  async getAttendance(@Query('month') month: number, @Query('year') year: number, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getAttendanceRecords(orgId, month, year);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Leaves
  @Post('leaves/types')
  @ApiOperation({ summary: 'Create leave type' })
  async createLeaveType(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createLeaveType(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('leaves/types')
  @ApiOperation({ summary: 'Get all leave types' })
  async getLeaveTypes(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLeaveTypes(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('leaves/apply')
  @ApiOperation({ summary: 'Apply for leave' })
  async applyLeave(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.applyLeave(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Leave application submitted', data: result };
  }

  @Patch('leaves/:id/approve')
  @ApiOperation({ summary: 'Approve or reject leave application' })
  async approveLeave(
    @Param('id') id: string,
    @Body() body: { approved: boolean; remarks: string },
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.hrPayrollService.approveLeave(id, body.approved, body.remarks, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Leave status updated', data: result };
  }

  @Get('leaves/requests')
  @ApiOperation({ summary: 'Get all leave requests' })
  async getLeaveRequests(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLeaveRequests(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Salary & Payroll
  @Post('payroll/structure')
  @ApiOperation({ summary: 'Set employee salary structure' })
  async setSalaryStructure(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.setSalaryStructure(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Post('payroll/generate')
  @ApiOperation({ summary: 'Generate monthly payroll sheet' })
  async generatePayroll(@Body() body: { year: number; month: number }, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.generatePayroll(body.year, body.month, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Monthly payroll generated', data: result };
  }

  @Patch('payroll/:id/disburse')
  @ApiOperation({ summary: 'Disburse monthly payroll' })
  async disbursePayroll(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.hrPayrollService.disbursePayroll(id, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Payroll disbursed successfully', data: result };
  }

  @Get('payroll')
  @ApiOperation({ summary: 'Get all payroll sheets' })
  async getPayrollSheets(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getPayrollSheets(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Commissions
  @Post('commissions/rules')
  @ApiOperation({ summary: 'Create sales commission rule' })
  async createCommissionRule(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createCommissionRule(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('commissions/rules')
  @ApiOperation({ summary: 'Get all commission rules' })
  async getCommissionRules(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getCommissionRules(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Get earned sales commissions' })
  async getCommissions(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getCommissions(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Targets
  @Post('targets')
  @ApiOperation({ summary: 'Set employee sales target' })
  async setSalesTarget(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.setSalesTarget(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('targets')
  @ApiOperation({ summary: 'Get sales targets and progress' })
  async getSalesTargets(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getSalesTargets(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
