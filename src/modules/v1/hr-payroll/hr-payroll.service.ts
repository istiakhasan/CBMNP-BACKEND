import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { Designation } from './entities/designation.entity';
import { Employee, EmploymentStatus } from './entities/employee.entity';
import { AttendanceRecord, AttendanceStatus } from './entities/attendance-record.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { SalaryStructure } from './entities/salary-structure.entity';
import { PayrollSheet, PayrollStatus } from './entities/payroll-sheet.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { CommissionRule, CommissionType } from './entities/commission-rule.entity';
import { CommissionRecord, CommissionRecordStatus } from './entities/commission-record.entity';
import { SalesTarget, TargetPeriod } from './entities/sales-target.entity';

@Injectable()
export class HrPayrollService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(SalaryStructure)
    private readonly salaryStructureRepo: Repository<SalaryStructure>,
    @InjectRepository(PayrollSheet)
    private readonly payrollSheetRepo: Repository<PayrollSheet>,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
    @InjectRepository(CommissionRule)
    private readonly commissionRuleRepo: Repository<CommissionRule>,
    @InjectRepository(CommissionRecord)
    private readonly commissionRecordRepo: Repository<CommissionRecord>,
    @InjectRepository(SalesTarget)
    private readonly salesTargetRepo: Repository<SalesTarget>,
  ) {}

  // ================= DEPARTMENTS & DESIGNATIONS =================
  async createDepartment(data: Partial<Department>, organizationId: string): Promise<Department> {
    const dept = this.departmentRepo.create({ ...data, organizationId });
    return this.departmentRepo.save(dept);
  }

  async getDepartments(organizationId: string): Promise<Department[]> {
    return this.departmentRepo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  async createDesignation(data: Partial<Designation>, organizationId: string): Promise<Designation> {
    const desig = this.designationRepo.create({ ...data, organizationId });
    return this.designationRepo.save(desig);
  }

  async getDesignations(organizationId: string): Promise<Designation[]> {
    return this.designationRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
      relations: ['department'],
    });
  }

  // ================= EMPLOYEE MASTER =================
  async createEmployee(data: Partial<Employee>, organizationId: string): Promise<Employee> {
    const existing = await this.employeeRepo.findOne({
      where: { organizationId, employeeCode: data.employeeCode?.trim() },
    });
    if (existing) throw new BadRequestException(`Employee code '${data.employeeCode}' already exists`);

    const emp = this.employeeRepo.create({ ...data, organizationId });
    return this.employeeRepo.save(emp);
  }

  async getEmployees(organizationId: string): Promise<Employee[]> {
    return this.employeeRepo.find({
      where: { organizationId },
      order: { employeeCode: 'ASC' },
      relations: ['department', 'designation', 'reportingManager', 'user'],
    });
  }

  // ================= ATTENDANCE =================
  async clockIn(employeeId: string, organizationId: string): Promise<AttendanceRecord> {
    const today = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];

    let record = await this.attendanceRepo.findOne({
      where: { organizationId, employeeId, attendanceDate: today },
    });

    if (record) throw new BadRequestException('Employee already clocked in today');

    // Detect late clock in (after 09:30:00)
    const hours = new Date().getHours();
    const minutes = new Date().getMinutes();
    let lateMins = 0;
    let status = AttendanceStatus.PRESENT;

    if (hours > 9 || (hours === 9 && minutes > 30)) {
      lateMins = (hours - 9) * 60 + (minutes - 30);
      status = AttendanceStatus.LATE;
    }

    record = this.attendanceRepo.create({
      employeeId,
      attendanceDate: today,
      clockInTime: timeStr,
      status,
      lateMinutes: lateMins,
      organizationId,
    });

    return this.attendanceRepo.save(record);
  }

  async clockOut(employeeId: string, organizationId: string): Promise<AttendanceRecord> {
    const today = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];

    const record = await this.attendanceRepo.findOne({
      where: { organizationId, employeeId, attendanceDate: today },
    });

    if (!record) throw new NotFoundException('Clock-in record not found for today');

    record.clockOutTime = timeStr;
    return this.attendanceRepo.save(record);
  }

  async getAttendanceRecords(organizationId: string, month?: number, year?: number) {
    return this.attendanceRepo.find({
      where: { organizationId },
      order: { attendanceDate: 'DESC' },
      relations: ['employee', 'employee.department'],
    });
  }

  // ================= LEAVES =================
  async createLeaveType(data: Partial<LeaveType>, organizationId: string): Promise<LeaveType> {
    const lt = this.leaveTypeRepo.create({ ...data, organizationId });
    return this.leaveTypeRepo.save(lt);
  }

  async getLeaveTypes(organizationId: string): Promise<LeaveType[]> {
    return this.leaveTypeRepo.find({ where: { organizationId } });
  }

  async applyLeave(data: Partial<LeaveRequest>, organizationId: string): Promise<LeaveRequest> {
    const req = this.leaveRequestRepo.create({ ...data, status: LeaveStatus.PENDING, organizationId });
    return this.leaveRequestRepo.save(req);
  }

  async approveLeave(requestId: string, approved: boolean, remarks: string, organizationId: string, userId?: string) {
    const req = await this.leaveRequestRepo.findOne({ where: { id: requestId, organizationId } });
    if (!req) throw new NotFoundException('Leave request not found');

    req.status = approved ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    req.approvedById = userId;
    req.approvalRemarks = remarks;

    return this.leaveRequestRepo.save(req);
  }

  async getLeaveRequests(organizationId: string) {
    return this.leaveRequestRepo.find({
      where: { organizationId },
      order: { startDate: 'DESC' },
      relations: ['employee', 'leaveType'],
    });
  }

  // ================= SALARY STRUCTURE & PAYROLL =================
  async setSalaryStructure(data: Partial<SalaryStructure>, organizationId: string): Promise<SalaryStructure> {
    let struct = await this.salaryStructureRepo.findOne({
      where: { organizationId, employeeId: data.employeeId },
    });

    if (struct) {
      Object.assign(struct, data);
    } else {
      struct = this.salaryStructureRepo.create({ ...data, organizationId });
    }
    return this.salaryStructureRepo.save(struct);
  }

  async generatePayroll(year: number, month: number, organizationId: string): Promise<PayrollSheet> {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const sheetName = `Payroll - ${monthNames[month - 1]} ${year}`;

    const existing = await this.payrollSheetRepo.findOne({
      where: { organizationId, year, month },
    });
    if (existing) {
      throw new BadRequestException(`Payroll sheet for ${monthNames[month - 1]} ${year} already generated`);
    }

    const employees = await this.employeeRepo.find({
      where: { organizationId, status: EmploymentStatus.ACTIVE },
    });

    const structures = await this.salaryStructureRepo.find({ where: { organizationId } });
    const structMap = new Map<string, SalaryStructure>();
    structures.forEach((s) => structMap.set(s.employeeId, s));

    // Get approved commissions for the month
    const commissions = await this.commissionRecordRepo.find({
      where: { organizationId, status: CommissionRecordStatus.APPROVED },
    });
    const commMap = new Map<string, number>();
    commissions.forEach((c) => {
      const current = commMap.get(c.employeeId) || 0;
      commMap.set(c.employeeId, current + Number(c.commissionAmount || 0));
    });

    return this.dataSource.transaction(async (manager) => {
      const sheet = manager.create(PayrollSheet, {
        year,
        month,
        sheetName,
        totalGrossSalary: 0,
        totalDeductions: 0,
        totalCommissions: 0,
        totalNetSalary: 0,
        status: PayrollStatus.DRAFT,
        organizationId,
      });

      const savedSheet = await manager.save(sheet);

      let totalGross = 0;
      let totalDed = 0;
      let totalComm = 0;
      let totalNet = 0;

      for (const emp of employees) {
        const s = structMap.get(emp.id);
        const basic = Number(s?.basicSalary || emp.basicSalary || 0);
        const allowances =
          Number(s?.houseRentAllowance || 0) +
          Number(s?.medicalAllowance || 0) +
          Number(s?.conveyanceAllowance || 0);
        const deductions = Number(s?.taxDeduction || 0) + Number(s?.providentFundDeduction || 0);
        const comm = commMap.get(emp.id) || 0;
        const net = basic + allowances + comm - deductions;

        totalGross += basic + allowances;
        totalDed += deductions;
        totalComm += comm;
        totalNet += net;

        const item = manager.create(PayrollItem, {
          payrollSheetId: savedSheet.id,
          employeeId: emp.id,
          basicSalary: basic,
          totalAllowances: allowances,
          commissionsEarned: comm,
          bonus: 0,
          unpaidLeaveDeductions: 0,
          taxDeductions: deductions,
          netSalary: net,
          paymentStatus: 'Unpaid',
          organizationId,
        });
        await manager.save(item);
      }

      savedSheet.totalGrossSalary = totalGross;
      savedSheet.totalDeductions = totalDed;
      savedSheet.totalCommissions = totalComm;
      savedSheet.totalNetSalary = totalNet;

      return manager.save(savedSheet);
    });
  }

  async disbursePayroll(sheetId: string, organizationId: string, userId?: string): Promise<PayrollSheet> {
    const sheet = await this.payrollSheetRepo.findOne({
      where: { id: sheetId, organizationId },
      relations: ['items'],
    });

    if (!sheet) throw new NotFoundException('Payroll sheet not found');
    if (sheet.status === PayrollStatus.DISBURSED) throw new BadRequestException('Payroll already disbursed');

    sheet.status = PayrollStatus.DISBURSED;
    sheet.disbursedDate = new Date().toISOString().split('T')[0];
    sheet.approvedById = userId;

    await this.payrollItemRepo.update({ payrollSheetId: sheetId }, { paymentStatus: 'Paid' });

    return this.payrollSheetRepo.save(sheet);
  }

  async getPayrollSheets(organizationId: string) {
    return this.payrollSheetRepo.find({
      where: { organizationId },
      order: { year: 'DESC', month: 'DESC' },
      relations: ['items', 'items.employee'],
    });
  }

  // ================= SALES COMMISSIONS =================
  async createCommissionRule(data: Partial<CommissionRule>, organizationId: string): Promise<CommissionRule> {
    const rule = this.commissionRuleRepo.create({ ...data, organizationId });
    return this.commissionRuleRepo.save(rule);
  }

  async getCommissionRules(organizationId: string): Promise<CommissionRule[]> {
    return this.commissionRuleRepo.find({ where: { organizationId } });
  }

  async calculateDeliveredOrderCommission(orderId: string, orderAmount: number, agentId: string, organizationId: string) {
    if (!agentId) return null;

    const employee = await this.employeeRepo.findOne({
      where: [{ userId: agentId, organizationId }, { id: agentId as any, organizationId }],
    });
    if (!employee) return null;

    const rule = await this.commissionRuleRepo.findOne({
      where: [
        { organizationId, specificEmployeeId: employee.id, isActive: true },
        { organizationId, specificEmployeeId: undefined, isActive: true },
      ],
    });

    if (!rule) return null;

    let commissionAmt = 0;
    if (rule.commissionType === CommissionType.PERCENTAGE_OF_ORDER) {
      commissionAmt = (orderAmount * Number(rule.rate)) / 100;
    } else {
      commissionAmt = Number(rule.rate);
    }

    const record = this.commissionRecordRepo.create({
      employeeId: employee.id,
      orderId,
      orderAmount,
      commissionAmount: commissionAmt,
      status: CommissionRecordStatus.APPROVED,
      earnedDate: new Date().toISOString().split('T')[0],
      organizationId,
    });

    return this.commissionRecordRepo.save(record);
  }

  async getCommissions(organizationId: string) {
    return this.commissionRecordRepo.find({
      where: { organizationId },
      order: { earnedDate: 'DESC' },
      relations: ['employee'],
    });
  }

  // ================= SALES TARGETS =================
  async setSalesTarget(data: Partial<SalesTarget>, organizationId: string): Promise<SalesTarget> {
    let target = await this.salesTargetRepo.findOne({
      where: {
        organizationId,
        employeeId: data.employeeId,
        year: data.year,
        periodValue: data.periodValue,
      },
    });

    if (target) {
      Object.assign(target, data);
    } else {
      target = this.salesTargetRepo.create({ ...data, organizationId });
    }
    return this.salesTargetRepo.save(target);
  }

  async getSalesTargets(organizationId: string) {
    return this.salesTargetRepo.find({
      where: { organizationId },
      order: { year: 'DESC', periodValue: 'ASC' },
      relations: ['employee'],
    });
  }
}
