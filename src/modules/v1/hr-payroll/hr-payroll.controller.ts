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
  Delete,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { HrPayrollService } from './hr-payroll.service';
import { Request } from 'express';

@ApiTags('HR & Payroll Enterprise')
@Controller('v1/hr-payroll')
export class HrPayrollController {
  constructor(private readonly hrPayrollService: HrPayrollService) {}

  // ================= DEPARTMENTS & DESIGNATIONS =================
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

  @Patch('departments/:id')
  async updateDepartment(@Param('id') id: string, @Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateDepartment(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Delete('departments/:id')
  async deleteDepartment(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.deleteDepartment(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('designations')
  async createDesignation(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createDesignation(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('designations')
  async getDesignations(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getDesignations(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('designations/:id')
  async updateDesignation(@Param('id') id: string, @Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateDesignation(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Delete('designations/:id')
  async deleteDesignation(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.deleteDesignation(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= BIOMETRIC DEVICE & WEBHOOK API =================
  @Post('biometric/devices')
  async registerDevice(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.registerBiometricDevice(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Biometric device registered', data: result };
  }

  @Get('biometric/devices')
  async getDevices(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getBiometricDevices(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('biometric/devices/:id')
  async updateDevice(@Param('id') id: string, @Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateBiometricDevice(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('biometric/devices/:id/regenerate-key')
  async regenerateDeviceKey(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.regenerateDeviceApiKey(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, message: 'New API Key generated', data: result };
  }

  @Delete('biometric/devices/:id')
  async deleteDevice(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.deleteBiometricDevice(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('biometric/sync')
  @ApiHeader({ name: 'x-device-api-key', required: false, description: 'Biometric device API key' })
  async syncBiometricPunches(
    @Body() body: any,
    @Headers('x-device-api-key') headerApiKey: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const apiKey = headerApiKey || body?.apiKey;
    const result = await this.hrPayrollService.processBiometricSync(apiKey, body, orgId);
    return { success: true, statusCode: HttpStatus.OK, ...result };
  }

  @Get('biometric/logs')
  async getPunchLogs(@Query('limit') limit = 50, @Query('offset') offset = 0, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getBiometricPunchLogs(orgId, Number(limit), Number(offset));
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= WORK SHIFTS & HOLIDAYS =================
  @Get('shifts')
  async getShifts(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getWorkShifts(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('shifts')
  async createShift(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createWorkShift(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Post('holidays')
  async createHoliday(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createHoliday(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('holidays')
  async getHolidays(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getHolidays(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Delete('holidays/:id')
  async deleteHoliday(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.deleteHoliday(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= EMPLOYEES =================
  @Post('employees')
  async createEmployee(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createEmployee(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('employees')
  async getEmployees(
    @Query('search') search: string,
    @Query('departmentId') departmentId: string,
    @Query('status') status: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getEmployees(orgId, search, departmentId, status);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('employees/:id')
  async getEmployeeById(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getEmployeeById(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('employees/:id')
  async updateEmployee(@Param('id') id: string, @Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateEmployee(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Delete('employees/:id')
  async deleteEmployee(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.deleteEmployee(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= ATTENDANCE =================
  @Post('attendance/clock-in')
  async clockIn(@Body() body: { employeeId: string }, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.clockIn(body.employeeId, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Clock-in recorded', data: result };
  }

  @Post('attendance/clock-out')
  async clockOut(@Body() body: { employeeId: string }, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.clockOut(body.employeeId, orgId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Clock-out recorded', data: result };
  }

  @Post('attendance/manual-entry')
  async manualAttendance(@Body() body: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.manualAttendanceEntry(body, orgId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Attendance updated', data: result };
  }

  @Get('attendance')
  async getAttendance(
    @Query('date') date: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('departmentId') departmentId: string,
    @Query('employeeId') employeeId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getAttendanceRecords(orgId, {
      date,
      month,
      year,
      departmentId,
      employeeId,
    });
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('attendance/summary')
  async getAttendanceSummary(@Query('date') date: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getAttendanceSummary(orgId, date);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= LEAVES =================
  @Post('leaves/types')
  async createLeaveType(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createLeaveType(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('leaves/types')
  async getLeaveTypes(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLeaveTypes(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('leaves/apply')
  async applyLeave(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.applyLeave(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Leave application submitted', data: result };
  }

  @Patch('leaves/:id/approve')
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
  async getLeaveRequests(
    @Query('employeeId') employeeId: string,
    @Query('status') status: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLeaveRequests(orgId, employeeId, status);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('leaves/balances/:employeeId')
  async getLeaveBalances(@Param('employeeId') employeeId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLeaveBalances(employeeId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= LOANS & ADVANCE SALARY =================
  @Post('loans')
  async requestLoan(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.requestLoan(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('loans')
  async getLoans(@Query('employeeId') employeeId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLoans(orgId, employeeId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('loans/:id/status')
  async updateLoanStatus(
    @Param('id') id: string,
    @Body() body: { status: any },
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.hrPayrollService.updateLoanStatus(id, body.status, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= EXPENSE CLAIMS =================
  @Post('expenses')
  async submitExpenseClaim(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.submitExpenseClaim(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('expenses')
  async getExpenseClaims(
    @Query('employeeId') employeeId: string,
    @Query('status') status: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getExpenseClaims(orgId, employeeId, status);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('expenses/:id/approve')
  async approveExpense(
    @Param('id') id: string,
    @Body() body: { approved: boolean; remarks: string },
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.hrPayrollService.approveExpenseClaim(id, body.approved, body.remarks, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= RECRUITMENT & ATS =================
  @Post('recruitment/jobs')
  async createJob(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createJobOpening(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('recruitment/jobs')
  async getJobs(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getJobOpenings(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('recruitment/applications')
  async applyJob(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.applyForJob(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('recruitment/applications')
  async getApplications(
    @Query('jobOpeningId') jobOpeningId: string,
    @Query('stage') stage: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getJobApplications(orgId, jobOpeningId, stage);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('recruitment/applications/:id/stage')
  async updateApplicationStage(
    @Param('id') id: string,
    @Body() body: { stage: any; notes?: string; rating?: number },
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateApplicationStage(id, body.stage, body.notes, body.rating, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('recruitment/applications/:id/hire')
  async hireCandidate(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.convertCandidateToEmployee(id, body, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Candidate hired & employee created', data: result };
  }

  // ================= ASSETS =================
  @Post('assets')
  async assignAsset(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.assignAsset(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('assets')
  async getAssets(@Query('employeeId') employeeId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getAssets(orgId, employeeId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('assets/:id/status')
  async updateAssetStatus(
    @Param('id') id: string,
    @Body() body: { status: any; conditionNotes?: string },
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateAssetStatus(id, body.status, body.conditionNotes, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= DOCUMENTS & PROMOTIONS =================
  @Post('documents')
  async uploadDoc(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.uploadDocument(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('documents/:employeeId')
  async getDocs(@Param('employeeId') employeeId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getEmployeeDocuments(employeeId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('promotions')
  async recordPromotion(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.recordPromotion(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  // ================= OFFBOARDING & CLEARANCES =================
  @Post('clearance/submit')
  async submitResignation(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.submitResignation(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('clearance')
  async getClearances(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getClearances(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('clearance/:id')
  async updateClearance(@Param('id') id: string, @Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateClearance(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= PAYROLL =================
  @Post('payroll/structure')
  async setSalaryStructure(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.setSalaryStructure(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('payroll/structure/:employeeId')
  async getSalaryStructure(@Param('employeeId') employeeId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getSalaryStructure(employeeId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('payroll/generate')
  async generatePayroll(@Body() body: { year: number; month: number }, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.generatePayroll(body.year, body.month, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, message: 'Monthly payroll generated', data: result };
  }

  @Patch('payroll/:id/disburse')
  async disbursePayroll(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await this.hrPayrollService.disbursePayroll(id, orgId, userId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Payroll disbursed successfully', data: result };
  }

  @Get('payroll')
  async getPayrollSheets(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getPayrollSheets(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('payroll/payslip/:itemId')
  async getPayslip(@Param('itemId') itemId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getPayslip(itemId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= COMMISSIONS & TARGETS =================
  @Post('commissions/rules')
  async createCommissionRule(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createCommissionRule(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('commissions/rules')
  async getCommissionRules(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getCommissionRules(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('commissions')
  async getCommissions(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getCommissions(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('targets')
  async setSalesTarget(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.setSalesTarget(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('targets')
  async getSalesTargets(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getSalesTargets(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= SHIFT UPDATE / DELETE =================
  @Patch('shifts/:id')
  @ApiOperation({ summary: 'Update work shift' })
  async updateWorkShift(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateWorkShift(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Delete('shifts/:id')
  @ApiOperation({ summary: 'Delete work shift' })
  async deleteWorkShift(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    await this.hrPayrollService.deleteWorkShift(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Shift deleted' };
  }

  // ================= HOLIDAY UPDATE =================
  @Patch('holidays/:id')
  @ApiOperation({ summary: 'Update holiday' })
  async updateHoliday(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateHoliday(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= DASHBOARD =================
  @Get('dashboard')
  @ApiOperation({ summary: 'HR Dashboard summary' })
  async getDashboardSummary(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getDashboardSummary(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= EMPLOYEE TIMELINE =================
  @Get('employees/:id/timeline')
  @ApiOperation({ summary: 'Get employee timeline events' })
  async getEmployeeTimeline(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getEmployeeTimeline(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('employees/:id/timeline')
  @ApiOperation({ summary: 'Record employee timeline event' })
  async recordTimelineEvent(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.recordTimelineEvent(
      { ...data, employeeId: id },
      orgId,
    );
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  // ================= SALARY HISTORY =================
  @Get('salary-history/:employeeId')
  @ApiOperation({ summary: 'Get salary revision history for employee' })
  async getSalaryHistory(
    @Param('employeeId') employeeId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getSalaryHistory(employeeId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('salary-history')
  @ApiOperation({ summary: 'Add salary revision' })
  async addSalaryRevision(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.addSalaryRevision(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  // ================= ATTENDANCE CORRECTIONS =================
  @Post('attendance/corrections')
  @ApiOperation({ summary: 'Submit attendance correction request' })
  async submitAttendanceCorrection(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.submitAttendanceCorrection(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('attendance/corrections')
  @ApiOperation({ summary: 'Get attendance correction requests' })
  async getAttendanceCorrections(
    @Query('employeeId') employeeId: string,
    @Query('status') status: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getAttendanceCorrections(
      orgId,
      employeeId,
      status,
    );
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('attendance/corrections/:id/approve')
  @ApiOperation({ summary: 'Approve/reject attendance correction' })
  async approveAttendanceCorrection(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.approveAttendanceCorrection(
      id,
      !!data.approved,
      data.remarks || '',
      orgId,
    );
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= OVERTIME =================
  @Post('overtime')
  @ApiOperation({ summary: 'Submit overtime request' })
  async submitOvertimeRequest(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.submitOvertimeRequest(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('overtime')
  @ApiOperation({ summary: 'Get overtime requests' })
  async getOvertimeRequests(
    @Query('employeeId') employeeId: string,
    @Query('status') status: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getOvertimeRequests(
      orgId,
      employeeId,
      status,
    );
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('overtime/:id/approve')
  @ApiOperation({ summary: 'Approve/reject overtime request' })
  async approveOvertimeRequest(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.approveOvertimeRequest(
      id,
      !!data.approved,
      Number(data.approvedHours || 0),
      data.remarks || '',
      orgId,
    );
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= TRANSFERS =================
  @Post('transfers')
  @ApiOperation({ summary: 'Record employee transfer' })
  async recordTransfer(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.recordTransfer(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Get employee transfers' })
  async getTransfers(
    @Query('employeeId') employeeId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getTransfers(orgId, employeeId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('transfers/:id/approve')
  @ApiOperation({ summary: 'Approve/reject transfer' })
  async approveTransfer(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.approveTransfer(
      id,
      !!data.approved,
      data.remarks || '',
      orgId,
    );
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= PERFORMANCE REVIEWS =================
  @Post('performance-reviews')
  @ApiOperation({ summary: 'Create performance review' })
  async createPerformanceReview(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createPerformanceReview(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('performance-reviews')
  @ApiOperation({ summary: 'Get performance reviews' })
  async getPerformanceReviews(
    @Query('employeeId') employeeId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getPerformanceReviews(orgId, employeeId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('performance-reviews/:id')
  @ApiOperation({ summary: 'Update performance review' })
  async updatePerformanceReview(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updatePerformanceReview(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= TRAINING =================
  @Post('training')
  @ApiOperation({ summary: 'Create training program' })
  async createTrainingProgram(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createTrainingProgram(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('training')
  @ApiOperation({ summary: 'Get training programs' })
  async getTrainingPrograms(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getTrainingPrograms(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('training/:id')
  @ApiOperation({ summary: 'Update training program' })
  async updateTrainingProgram(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateTrainingProgram(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Post('training/enroll')
  @ApiOperation({ summary: 'Enroll employee in training' })
  async enrollInTraining(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    // Accept either a single employeeId or an array
    const employeeIds: string[] = Array.isArray(data.employeeIds)
      ? data.employeeIds
      : [data.employeeId].filter(Boolean);
    const result = await this.hrPayrollService.enrollInTraining(
      data.trainingProgramId,
      employeeIds,
      orgId,
    );
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Patch('training/enrollments/:id')
  @ApiOperation({ summary: 'Update training enrollment' })
  async updateEnrollment(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateEnrollment(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Get('training/enrollments/:employeeId')
  @ApiOperation({ summary: 'Get enrollments by employee' })
  async getEnrollmentsByEmployee(
    @Param('employeeId') employeeId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getEnrollmentsByEmployee(employeeId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= DISCIPLINARY ACTIONS =================
  @Post('disciplinary')
  @ApiOperation({ summary: 'Create disciplinary action' })
  async createDisciplinaryAction(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createDisciplinaryAction(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('disciplinary')
  @ApiOperation({ summary: 'Get disciplinary actions' })
  async getDisciplinaryActions(
    @Query('employeeId') employeeId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getDisciplinaryActions(orgId, employeeId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('disciplinary/:id')
  @ApiOperation({ summary: 'Update disciplinary action' })
  async updateDisciplinaryAction(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateDisciplinaryAction(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= ANNOUNCEMENTS =================
  @Post('announcements')
  @ApiOperation({ summary: 'Create HR announcement' })
  async createAnnouncement(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.createAnnouncement(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get HR announcements' })
  async getAnnouncements(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getAnnouncements(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Patch('announcements/:id')
  @ApiOperation({ summary: 'Update HR announcement' })
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.updateAnnouncement(id, data, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  @Delete('announcements/:id')
  @ApiOperation({ summary: 'Delete HR announcement' })
  async deleteAnnouncement(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    await this.hrPayrollService.deleteAnnouncement(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, message: 'Announcement deleted' };
  }

  // ================= LOAN REPAYMENTS =================
  @Post('loans/:loanId/repayments')
  @ApiOperation({ summary: 'Record loan repayment' })
  async recordLoanRepayment(
    @Param('loanId') loanId: string,
    @Body() data: any,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.recordLoanRepayment(
      { ...data, loanId },
      orgId,
    );
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('loans/:loanId/repayments')
  @ApiOperation({ summary: 'Get loan repayments' })
  async getLoanRepayments(@Param('loanId') loanId: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLoanRepayments(loanId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= FINAL SETTLEMENT =================
  @Get('employees/:id/final-settlement')
  @ApiOperation({ summary: 'Compute final settlement for employee' })
  async computeFinalSettlement(@Param('id') id: string, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.computeFinalSettlement(id, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= REPORTS =================
  @Get('reports')
  @ApiOperation({ summary: 'Generate HR report' })
  async getHrReport(
    @Query('type') type: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getHrReport(orgId, type, { fromDate: from, toDate: to });
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= LEAVE CALENDAR =================
  @Get('leave-calendar')
  @ApiOperation({ summary: 'Get leave calendar for month' })
  async getLeaveCalendar(
    @Query('year') year: string,
    @Query('month') month: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getLeaveCalendar(
      orgId,
      parseInt(month),
      parseInt(year),
    );
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // ================= PAYROLL SHEET ITEMS =================
  @Get('payroll-sheets/:sheetId/items')
  @ApiOperation({ summary: 'Get payroll sheet with items' })
  async getPayrollSheetItems(
    @Param('sheetId') sheetId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.hrPayrollService.getPayrollSheetItems(sheetId, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
