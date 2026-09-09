import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Department } from './entities/department.entity';
import { Designation } from './entities/designation.entity';
import { Employee, EmploymentStatus } from './entities/employee.entity';
import { AttendanceRecord, AttendanceStatus, PunchSource } from './entities/attendance-record.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { SalaryStructure } from './entities/salary-structure.entity';
import { PayrollSheet, PayrollStatus } from './entities/payroll-sheet.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { CommissionRule, CommissionType } from './entities/commission-rule.entity';
import { CommissionRecord, CommissionRecordStatus } from './entities/commission-record.entity';
import { SalesTarget } from './entities/sales-target.entity';
import { BiometricDevice } from './entities/biometric-device.entity';
import { BiometricPunchLog, PunchDirection } from './entities/biometric-punch-log.entity';
import { WorkShift } from './entities/work-shift.entity';
import { JobOpening } from './entities/job-opening.entity';
import { JobApplication, ApplicationStage } from './entities/job-application.entity';
import { EmployeeLoan, LoanStatus } from './entities/employee-loan.entity';
import { ExpenseClaim, ExpenseClaimStatus } from './entities/expense-claim.entity';
import { Holiday } from './entities/holiday.entity';
import { EmployeeAsset, AssetStatus } from './entities/employee-asset.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { PromotionHistory } from './entities/promotion-history.entity';
import { ResignationClearance, ClearanceStatus } from './entities/resignation-clearance.entity';

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
    @InjectRepository(BiometricDevice)
    private readonly biometricDeviceRepo: Repository<BiometricDevice>,
    @InjectRepository(BiometricPunchLog)
    private readonly punchLogRepo: Repository<BiometricPunchLog>,
    @InjectRepository(WorkShift)
    private readonly workShiftRepo: Repository<WorkShift>,
    @InjectRepository(JobOpening)
    private readonly jobOpeningRepo: Repository<JobOpening>,
    @InjectRepository(JobApplication)
    private readonly jobApplicationRepo: Repository<JobApplication>,
    @InjectRepository(EmployeeLoan)
    private readonly loanRepo: Repository<EmployeeLoan>,
    @InjectRepository(ExpenseClaim)
    private readonly expenseClaimRepo: Repository<ExpenseClaim>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    @InjectRepository(EmployeeAsset)
    private readonly assetRepo: Repository<EmployeeAsset>,
    @InjectRepository(EmployeeDocument)
    private readonly documentRepo: Repository<EmployeeDocument>,
    @InjectRepository(PromotionHistory)
    private readonly promotionRepo: Repository<PromotionHistory>,
    @InjectRepository(ResignationClearance)
    private readonly clearanceRepo: Repository<ResignationClearance>,
  ) {}

  // ================= 1. DEPARTMENTS & DESIGNATIONS =================
  async createDepartment(data: Partial<Department>, organizationId: string): Promise<Department> {
    const dept = this.departmentRepo.create({ ...data, organizationId });
    return this.departmentRepo.save(dept);
  }

  async getDepartments(organizationId: string): Promise<Department[]> {
    return this.departmentRepo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  async updateDepartment(id: string, data: Partial<Department>, organizationId: string): Promise<Department> {
    const dept = await this.departmentRepo.findOne({ where: { id, organizationId } });
    if (!dept) throw new NotFoundException('Department not found');
    Object.assign(dept, data);
    return this.departmentRepo.save(dept);
  }

  async deleteDepartment(id: string, organizationId: string): Promise<{ success: boolean }> {
    const dept = await this.departmentRepo.findOne({ where: { id, organizationId } });
    if (!dept) throw new NotFoundException('Department not found');
    await this.departmentRepo.remove(dept);
    return { success: true };
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

  async updateDesignation(id: string, data: Partial<Designation>, organizationId: string): Promise<Designation> {
    const desig = await this.designationRepo.findOne({ where: { id, organizationId } });
    if (!desig) throw new NotFoundException('Designation not found');
    Object.assign(desig, data);
    return this.designationRepo.save(desig);
  }

  async deleteDesignation(id: string, organizationId: string): Promise<{ success: boolean }> {
    const desig = await this.designationRepo.findOne({ where: { id, organizationId } });
    if (!desig) throw new NotFoundException('Designation not found');
    await this.designationRepo.remove(desig);
    return { success: true };
  }

  // ================= 2. BIOMETRIC DEVICES & HARDWARE WEBHOOK =================
  async registerBiometricDevice(data: Partial<BiometricDevice>, organizationId: string): Promise<BiometricDevice> {
    const generatedKey = `cbmnp_bio_${crypto.randomBytes(16).toString('hex')}`;
    const device = this.biometricDeviceRepo.create({
      ...data,
      apiKey: data.apiKey || generatedKey,
      organizationId,
    });
    return this.biometricDeviceRepo.save(device);
  }

  async getBiometricDevices(organizationId: string): Promise<BiometricDevice[]> {
    return this.biometricDeviceRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateBiometricDevice(id: string, data: Partial<BiometricDevice>, organizationId: string): Promise<BiometricDevice> {
    const device = await this.biometricDeviceRepo.findOne({ where: { id, organizationId } });
    if (!device) throw new NotFoundException('Biometric device not found');
    Object.assign(device, data);
    return this.biometricDeviceRepo.save(device);
  }

  async regenerateDeviceApiKey(id: string, organizationId: string): Promise<BiometricDevice> {
    const device = await this.biometricDeviceRepo.findOne({ where: { id, organizationId } });
    if (!device) throw new NotFoundException('Biometric device not found');
    device.apiKey = `cbmnp_bio_${crypto.randomBytes(16).toString('hex')}`;
    return this.biometricDeviceRepo.save(device);
  }

  async deleteBiometricDevice(id: string, organizationId: string): Promise<{ success: boolean }> {
    const device = await this.biometricDeviceRepo.findOne({ where: { id, organizationId } });
    if (!device) throw new NotFoundException('Biometric device not found');
    await this.biometricDeviceRepo.remove(device);
    return { success: true };
  }

  async processBiometricSync(
    apiKey: string,
    payload: {
      logs?: Array<{
        biometricUserId: string;
        timestamp: string | Date;
        punchType?: string;
        verifyType?: string;
      }>;
      biometricUserId?: string;
      timestamp?: string | Date;
      punchType?: string;
      verifyType?: string;
    },
    orgHeader?: string,
  ) {
    if (!apiKey && !orgHeader) {
      throw new UnauthorizedException('Device API key or Organization context required');
    }

    let device: BiometricDevice | null = null;
    let organizationId = orgHeader;

    if (apiKey) {
      device = await this.biometricDeviceRepo.findOne({ where: { apiKey } });
      if (!device) throw new UnauthorizedException('Invalid Biometric Device API Key');
      organizationId = device.organizationId;
    }

    if (!organizationId) throw new BadRequestException('Organization ID missing');

    const rawLogs = payload.logs && Array.isArray(payload.logs)
      ? payload.logs
      : payload.biometricUserId
      ? [{
          biometricUserId: payload.biometricUserId,
          timestamp: payload.timestamp || new Date(),
          punchType: payload.punchType,
          verifyType: payload.verifyType,
        }]
      : [];

    if (rawLogs.length === 0) throw new BadRequestException('No punch logs provided in payload');

    const defaultShift = await this.workShiftRepo.findOne({
      where: { organizationId, isDefault: true },
    });
    const shiftStartTime = defaultShift?.startTime || '09:00:00';
    const graceMinutes = defaultShift?.graceMinutes !== undefined ? defaultShift.graceMinutes : 15;

    let processedCount = 0;
    let matchedCount = 0;
    const results: any[] = [];

    for (const item of rawLogs) {
      if (!item.biometricUserId) continue;

      const punchDateObj = new Date(item.timestamp);
      const attendanceDate = punchDateObj.toISOString().split('T')[0];
      const punchTimeStr = punchDateObj.toTimeString().split(' ')[0];

      const employee = await this.employeeRepo.findOne({
        where: [
          { organizationId, biometricUserId: item.biometricUserId.trim() },
          { organizationId, employeeCode: item.biometricUserId.trim() },
        ],
      });

      const punchLog = this.punchLogRepo.create({
        deviceId: device?.id || undefined,
        biometricUserId: item.biometricUserId.trim(),
        punchTime: punchDateObj,
        punchType: (item.punchType as any) || PunchDirection.AUTO,
        verifyType: item.verifyType || 'Fingerprint',
        matchedEmployeeId: employee?.id || undefined,
        isProcessed: true,
        rawPayload: JSON.stringify(item),
        organizationId,
      });
      await this.punchLogRepo.save(punchLog);
      processedCount++;

      if (employee) {
        matchedCount++;
        let record = await this.attendanceRepo.findOne({
          where: { organizationId, employeeId: employee.id, attendanceDate },
        });

        if (!record) {
          const [sH, sM] = shiftStartTime.split(':').map(Number);
          const [pH, pM] = punchTimeStr.split(':').map(Number);
          const shiftMinutes = sH * 60 + sM + graceMinutes;
          const punchMinutes = pH * 60 + pM;

          let lateMins = 0;
          let status = AttendanceStatus.PRESENT;
          if (punchMinutes > shiftMinutes) {
            lateMins = punchMinutes - (sH * 60 + sM);
            status = AttendanceStatus.LATE;
          }

          record = this.attendanceRepo.create({
            employeeId: employee.id,
            attendanceDate,
            clockInTime: punchTimeStr,
            status,
            lateMinutes: lateMins,
            punchSource: PunchSource.BIOMETRIC,
            deviceId: device?.id || undefined,
            remarks: `Biometric Punch (${item.verifyType || 'Fingerprint'}) via ${device?.name || 'Device API'}`,
            organizationId,
          });
        } else {
          record.clockOutTime = punchTimeStr;
          record.punchSource = PunchSource.BIOMETRIC;

          if (record.clockInTime) {
            const [inH, inM, inS] = record.clockInTime.split(':').map(Number);
            const [outH, outM, outS] = punchTimeStr.split(':').map(Number);
            const totalSecs = (outH * 3600 + outM * 60 + (outS || 0)) - (inH * 3600 + inM * 60 + (inS || 0));
            const hours = Math.max(0, Number((totalSecs / 3600).toFixed(2)));
            record.workHours = hours;

            const standardHours = defaultShift?.fullDayHours || 8;
            if (hours > standardHours) {
              record.overtimeMinutes = Math.round((hours - standardHours) * 60);
            }
          }
        }

        const savedRecord = await this.attendanceRepo.save(record);
        results.push({
          biometricUserId: item.biometricUserId,
          employee: employee.fullName,
          attendanceRecord: savedRecord,
        });
      }
    }

    if (device) {
      device.lastSyncAt = new Date();
      device.totalPunchesRecorded = (device.totalPunchesRecorded || 0) + processedCount;
      await this.biometricDeviceRepo.save(device);
    }

    return {
      success: true,
      message: `Processed ${processedCount} punch logs (${matchedCount} matched to active employees)`,
      processedCount,
      matchedCount,
      data: results,
    };
  }

  async getBiometricPunchLogs(organizationId: string, limit = 50, offset = 0) {
    const [logs, total] = await this.punchLogRepo.findAndCount({
      where: { organizationId },
      order: { punchTime: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['device', 'matchedEmployee', 'matchedEmployee.department'],
    });
    return { logs, total };
  }

  // ================= 3. WORK SHIFTS & HOLIDAYS =================
  async getWorkShifts(organizationId: string): Promise<WorkShift[]> {
    return this.workShiftRepo.find({ where: { organizationId }, order: { createdAt: 'ASC' } });
  }

  async createWorkShift(data: Partial<WorkShift>, organizationId: string): Promise<WorkShift> {
    if (data.isDefault) {
      await this.workShiftRepo.update({ organizationId }, { isDefault: false });
    }
    const shift = this.workShiftRepo.create({ ...data, organizationId });
    return this.workShiftRepo.save(shift);
  }

  async createHoliday(data: Partial<Holiday>, organizationId: string): Promise<Holiday> {
    let days = data.totalDays;
    if (!days && data.fromDate && data.toDate) {
      const s = new Date(data.fromDate);
      const e = new Date(data.toDate);
      days = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    const holiday = this.holidayRepo.create({ ...data, totalDays: days || 1, organizationId });
    return this.holidayRepo.save(holiday);
  }

  async getHolidays(organizationId: string): Promise<Holiday[]> {
    return this.holidayRepo.find({ where: { organizationId }, order: { fromDate: 'ASC' } });
  }

  async deleteHoliday(id: string, organizationId: string): Promise<{ success: boolean }> {
    const h = await this.holidayRepo.findOne({ where: { id, organizationId } });
    if (!h) throw new NotFoundException('Holiday not found');
    await this.holidayRepo.remove(h);
    return { success: true };
  }

  // ================= 4. EMPLOYEE MASTER & 360 PROFILE =================
  async createEmployee(data: Partial<Employee>, organizationId: string): Promise<Employee> {
    const existing = await this.employeeRepo.findOne({
      where: { organizationId, employeeCode: data.employeeCode?.trim() },
    });
    if (existing) throw new BadRequestException(`Employee code '${data.employeeCode}' already exists`);

    if (data.biometricUserId) {
      const existingBio = await this.employeeRepo.findOne({
        where: { organizationId, biometricUserId: data.biometricUserId.trim() },
      });
      if (existingBio) {
        throw new BadRequestException(`Biometric machine user ID '${data.biometricUserId}' is already assigned to ${existingBio.fullName}`);
      }
    }

    const emp = this.employeeRepo.create({ ...data, organizationId });
    const saved = await this.employeeRepo.save(emp);

    if (data.basicSalary && Number(data.basicSalary) > 0) {
      await this.setSalaryStructure(
        {
          employeeId: saved.id,
          basicSalary: data.basicSalary,
          houseRentAllowance: Number((Number(data.basicSalary) * 0.2).toFixed(2)),
          medicalAllowance: Number((Number(data.basicSalary) * 0.1).toFixed(2)),
          conveyanceAllowance: 1000,
        },
        organizationId,
      );
    }

    return saved;
  }

  async getEmployees(organizationId: string, search?: string, departmentId?: string, status?: string): Promise<Employee[]> {
    const query = this.employeeRepo.createQueryBuilder('emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .leftJoinAndSelect('emp.designation', 'desig')
      .leftJoinAndSelect('emp.reportingManager', 'mgr')
      .leftJoinAndSelect('emp.user', 'usr')
      .where('emp.organizationId = :organizationId', { organizationId });

    if (departmentId) query.andWhere('emp.departmentId = :departmentId', { departmentId });
    if (status) query.andWhere('emp.status = :status', { status });
    if (search && search.trim()) {
      query.andWhere(
        '(LOWER(emp.fullName) LIKE LOWER(:s) OR LOWER(emp.employeeCode) LIKE LOWER(:s) OR LOWER(emp.phone) LIKE LOWER(:s) OR LOWER(emp.biometricUserId) LIKE LOWER(:s))',
        { s: `%${search.trim()}%` },
      );
    }
    query.orderBy('emp.employeeCode', 'ASC');
    return query.getMany();
  }

  async getEmployeeById(id: string, organizationId: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id, organizationId },
      relations: ['department', 'designation', 'reportingManager', 'user'],
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const salaryStructure = await this.salaryStructureRepo.findOne({
      where: { employeeId: id, organizationId },
    });

    const recentAttendance = await this.attendanceRepo.find({
      where: { employeeId: id, organizationId },
      order: { attendanceDate: 'DESC' },
      take: 10,
    });

    const leaveBalances = await this.getLeaveBalances(id, organizationId);
    const assignedAssets = await this.assetRepo.find({
      where: { employeeId: id, organizationId, status: AssetStatus.ASSIGNED },
    });
    const documents = await this.documentRepo.find({
      where: { employeeId: id, organizationId },
    });
    const promotions = await this.promotionRepo.find({
      where: { employeeId: id, organizationId },
      order: { effectiveDate: 'DESC' },
    });

    return {
      employee,
      salaryStructure,
      recentAttendance,
      leaveBalances,
      assignedAssets,
      documents,
      promotions,
    };
  }

  async updateEmployee(id: string, data: Partial<Employee>, organizationId: string): Promise<Employee> {
    const emp = await this.employeeRepo.findOne({ where: { id, organizationId } });
    if (!emp) throw new NotFoundException('Employee not found');

    if (data.biometricUserId && data.biometricUserId !== emp.biometricUserId) {
      const existingBio = await this.employeeRepo.findOne({
        where: { organizationId, biometricUserId: data.biometricUserId.trim() },
      });
      if (existingBio && existingBio.id !== id) {
        throw new BadRequestException(`Biometric machine user ID '${data.biometricUserId}' is already assigned to ${existingBio.fullName}`);
      }
    }

    Object.assign(emp, data);
    return this.employeeRepo.save(emp);
  }

  async deleteEmployee(id: string, organizationId: string): Promise<{ success: boolean }> {
    const emp = await this.employeeRepo.findOne({ where: { id, organizationId } });
    if (!emp) throw new NotFoundException('Employee not found');
    await this.employeeRepo.remove(emp);
    return { success: true };
  }

  // ================= 5. ATTENDANCE & ROSTER =================
  async clockIn(employeeId: string, organizationId: string): Promise<AttendanceRecord> {
    const today = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0];

    let record = await this.attendanceRepo.findOne({
      where: { organizationId, employeeId, attendanceDate: today },
    });
    if (record) throw new BadRequestException('Employee already clocked in today');

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
      punchSource: PunchSource.WEB_MANUAL,
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
    if (record.clockInTime) {
      const [inH, inM] = record.clockInTime.split(':').map(Number);
      const [outH, outM] = timeStr.split(':').map(Number);
      record.workHours = Math.max(0, Number(((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(2)));
    }
    return this.attendanceRepo.save(record);
  }

  async manualAttendanceEntry(data: {
    employeeId: string;
    attendanceDate: string;
    clockInTime?: string;
    clockOutTime?: string;
    status: AttendanceStatus;
    lateMinutes?: number;
    remarks?: string;
  }, organizationId: string): Promise<AttendanceRecord> {
    let record = await this.attendanceRepo.findOne({
      where: { organizationId, employeeId: data.employeeId, attendanceDate: data.attendanceDate },
    });

    if (record) {
      Object.assign(record, data);
      record.punchSource = PunchSource.WEB_MANUAL;
    } else {
      record = this.attendanceRepo.create({ ...data, punchSource: PunchSource.WEB_MANUAL, organizationId });
    }

    if (record.clockInTime && record.clockOutTime) {
      const [inH, inM] = record.clockInTime.split(':').map(Number);
      const [outH, outM] = record.clockOutTime.split(':').map(Number);
      record.workHours = Math.max(0, Number(((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(2)));
    }
    return this.attendanceRepo.save(record);
  }

  async getAttendanceRecords(
    organizationId: string,
    params?: { date?: string; month?: number; year?: number; departmentId?: string; employeeId?: string },
  ) {
    const query = this.attendanceRepo.createQueryBuilder('att')
      .leftJoinAndSelect('att.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .leftJoinAndSelect('att.device', 'dev')
      .where('att.organizationId = :organizationId', { organizationId });

    if (params?.date) query.andWhere('att.attendanceDate = :date', { date: params.date });
    if (params?.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
    if (params?.employeeId) query.andWhere('att.employeeId = :empId', { empId: params.employeeId });

    query.orderBy('att.attendanceDate', 'DESC').addOrderBy('att.clockInTime', 'ASC');
    return query.getMany();
  }

  async getAttendanceSummary(organizationId: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const totalEmployees = await this.employeeRepo.count({
      where: { organizationId, status: EmploymentStatus.ACTIVE },
    });

    const records = await this.attendanceRepo.find({
      where: { organizationId, attendanceDate: targetDate },
    });

    const presentCount = records.filter(r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE).length;
    const lateCount = records.filter(r => r.status === AttendanceStatus.LATE).length;
    const onLeaveCount = records.filter(r => r.status === AttendanceStatus.ON_LEAVE).length;
    const absentCount = Math.max(0, totalEmployees - (presentCount + onLeaveCount));

    return { targetDate, totalEmployees, presentCount, lateCount, onLeaveCount, absentCount };
  }

  // ================= 6. LEAVES & BALANCES =================
  async createLeaveType(data: Partial<LeaveType>, organizationId: string): Promise<LeaveType> {
    const lt = this.leaveTypeRepo.create({ ...data, organizationId });
    return this.leaveTypeRepo.save(lt);
  }

  async getLeaveTypes(organizationId: string): Promise<LeaveType[]> {
    return this.leaveTypeRepo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  async applyLeave(data: Partial<LeaveRequest>, organizationId: string): Promise<LeaveRequest> {
    let days = data.daysCount;
    if (!days && data.startDate && data.endDate) {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      days = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    const req = this.leaveRequestRepo.create({
      ...data,
      daysCount: days || 1,
      status: LeaveStatus.PENDING,
      organizationId,
    });
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

  async getLeaveRequests(organizationId: string, employeeId?: string, status?: string) {
    const query = this.leaveRequestRepo.createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .where('lr.organizationId = :organizationId', { organizationId });

    if (employeeId) query.andWhere('lr.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('lr.status = :status', { status });
    query.orderBy('lr.createdAt', 'DESC');
    return query.getMany();
  }

  async getLeaveBalances(employeeId: string, organizationId: string) {
    const leaveTypes = await this.leaveTypeRepo.find({ where: { organizationId, isActive: true } });
    const approvedRequests = await this.leaveRequestRepo.find({
      where: { employeeId, organizationId, status: LeaveStatus.APPROVED },
    });

    return leaveTypes.map(lt => {
      const usedDays = approvedRequests
        .filter(r => r.leaveTypeId === lt.id)
        .reduce((sum, r) => sum + (r.daysCount || 0), 0);
      const totalAllowed = lt.daysAllowedPerYear || 14;
      return {
        leaveTypeId: lt.id,
        leaveTypeName: lt.name,
        isPaid: lt.isPaid,
        totalAllowed,
        usedDays,
        remainingDays: Math.max(0, totalAllowed - usedDays),
      };
    });
  }

  // ================= 7. ADVANCE SALARY & COMPANY LOANS =================
  async requestLoan(data: Partial<EmployeeLoan>, organizationId: string): Promise<EmployeeLoan> {
    const principal = Number(data.principalAmount || 0);
    const installments = Number(data.totalInstallments || 1);
    const monthlyEmi = Number((principal / installments).toFixed(2));

    const loan = this.loanRepo.create({
      ...data,
      monthlyEmiAmount: monthlyEmi,
      totalPaidAmount: 0,
      status: LoanStatus.PENDING,
      organizationId,
    });
    return this.loanRepo.save(loan);
  }

  async getLoans(organizationId: string, employeeId?: string): Promise<EmployeeLoan[]> {
    const query = this.loanRepo.createQueryBuilder('loan')
      .leftJoinAndSelect('loan.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('loan.organizationId = :organizationId', { organizationId });

    if (employeeId) query.andWhere('loan.employeeId = :employeeId', { employeeId });
    query.orderBy('loan.createdAt', 'DESC');
    return query.getMany();
  }

  async updateLoanStatus(id: string, status: LoanStatus, organizationId: string, userId?: string): Promise<EmployeeLoan> {
    const loan = await this.loanRepo.findOne({ where: { id, organizationId } });
    if (!loan) throw new NotFoundException('Loan record not found');
    loan.status = status;
    loan.approvedById = userId;
    if (status === LoanStatus.APPROVED || status === LoanStatus.RUNNING) {
      loan.disbursedDate = new Date().toISOString().split('T')[0];
    }
    return this.loanRepo.save(loan);
  }

  // ================= 8. EXPENSE CLAIMS & REIMBURSEMENTS =================
  async submitExpenseClaim(data: Partial<ExpenseClaim>, organizationId: string): Promise<ExpenseClaim> {
    const claim = this.expenseClaimRepo.create({
      ...data,
      status: ExpenseClaimStatus.PENDING,
      organizationId,
    });
    return this.expenseClaimRepo.save(claim);
  }

  async getExpenseClaims(organizationId: string, employeeId?: string, status?: string): Promise<ExpenseClaim[]> {
    const query = this.expenseClaimRepo.createQueryBuilder('claim')
      .leftJoinAndSelect('claim.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('claim.organizationId = :organizationId', { organizationId });

    if (employeeId) query.andWhere('claim.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('claim.status = :status', { status });
    query.orderBy('claim.expenseDate', 'DESC');
    return query.getMany();
  }

  async approveExpenseClaim(id: string, approved: boolean, remarks: string, organizationId: string, userId?: string) {
    const claim = await this.expenseClaimRepo.findOne({ where: { id, organizationId } });
    if (!claim) throw new NotFoundException('Expense claim not found');
    claim.status = approved ? ExpenseClaimStatus.APPROVED : ExpenseClaimStatus.REJECTED;
    claim.approvedById = userId;
    claim.remarks = remarks;
    return this.expenseClaimRepo.save(claim);
  }

  // ================= 9. RECRUITMENT & ATS =================
  async createJobOpening(data: Partial<JobOpening>, organizationId: string): Promise<JobOpening> {
    const job = this.jobOpeningRepo.create({ ...data, organizationId });
    return this.jobOpeningRepo.save(job);
  }

  async getJobOpenings(organizationId: string): Promise<JobOpening[]> {
    return this.jobOpeningRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: ['department', 'designation'],
    });
  }

  async applyForJob(data: Partial<JobApplication>, organizationId: string): Promise<JobApplication> {
    const app = this.jobApplicationRepo.create({
      ...data,
      stage: ApplicationStage.APPLIED,
      organizationId,
    });
    return this.jobApplicationRepo.save(app);
  }

  async getJobApplications(organizationId: string, jobOpeningId?: string, stage?: string): Promise<JobApplication[]> {
    const query = this.jobApplicationRepo.createQueryBuilder('app')
      .leftJoinAndSelect('app.jobOpening', 'job')
      .leftJoinAndSelect('app.convertedEmployee', 'emp')
      .where('app.organizationId = :organizationId', { organizationId });

    if (jobOpeningId) query.andWhere('app.jobOpeningId = :jobOpeningId', { jobOpeningId });
    if (stage) query.andWhere('app.stage = :stage', { stage });
    query.orderBy('app.createdAt', 'DESC');
    return query.getMany();
  }

  async updateApplicationStage(id: string, stage: ApplicationStage, notes?: string, rating?: number, organizationId?: string) {
    const app = await this.jobApplicationRepo.findOne({ where: { id, organizationId } });
    if (!app) throw new NotFoundException('Application not found');
    app.stage = stage;
    if (notes) app.interviewerNotes = notes;
    if (rating) app.rating = rating;
    return this.jobApplicationRepo.save(app);
  }

  async convertCandidateToEmployee(applicationId: string, employeeData: Partial<Employee>, organizationId: string): Promise<Employee> {
    const app = await this.jobApplicationRepo.findOne({
      where: { id: applicationId, organizationId },
      relations: ['jobOpening'],
    });
    if (!app) throw new NotFoundException('Application not found');

    const emp = await this.createEmployee(
      {
        fullName: app.candidateName,
        email: app.candidateEmail,
        phone: app.candidatePhone,
        departmentId: app.jobOpening?.departmentId,
        designationId: app.jobOpening?.designationId,
        basicSalary: app.expectedSalary || 30000,
        ...employeeData,
      },
      organizationId,
    );

    app.stage = ApplicationStage.HIRED;
    app.convertedEmployeeId = emp.id;
    await this.jobApplicationRepo.save(app);

    return emp;
  }

  // ================= 10. ASSET MANAGEMENT =================
  async assignAsset(data: Partial<EmployeeAsset>, organizationId: string): Promise<EmployeeAsset> {
    const asset = this.assetRepo.create({
      ...data,
      status: AssetStatus.ASSIGNED,
      assignedDate: data.assignedDate || new Date().toISOString().split('T')[0],
      organizationId,
    });
    return this.assetRepo.save(asset);
  }

  async getAssets(organizationId: string, employeeId?: string): Promise<EmployeeAsset[]> {
    const query = this.assetRepo.createQueryBuilder('ast')
      .leftJoinAndSelect('ast.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('ast.organizationId = :organizationId', { organizationId });

    if (employeeId) query.andWhere('ast.employeeId = :employeeId', { employeeId });
    query.orderBy('ast.assignedDate', 'DESC');
    return query.getMany();
  }

  async updateAssetStatus(id: string, status: AssetStatus, conditionNotes?: string, organizationId?: string): Promise<EmployeeAsset> {
    const asset = await this.assetRepo.findOne({ where: { id, organizationId } });
    if (!asset) throw new NotFoundException('Asset record not found');
    asset.status = status;
    if (status === AssetStatus.RETURNED) asset.returnDate = new Date().toISOString().split('T')[0];
    if (conditionNotes) asset.conditionNotes = conditionNotes;
    return this.assetRepo.save(asset);
  }

  // ================= 11. DOCUMENTS & PROMOTIONS =================
  async uploadDocument(data: Partial<EmployeeDocument>, organizationId: string): Promise<EmployeeDocument> {
    const doc = this.documentRepo.create({ ...data, organizationId });
    return this.documentRepo.save(doc);
  }

  async getEmployeeDocuments(employeeId: string, organizationId: string): Promise<EmployeeDocument[]> {
    return this.documentRepo.find({ where: { employeeId, organizationId } });
  }

  async recordPromotion(data: Partial<PromotionHistory>, organizationId: string): Promise<PromotionHistory> {
    const promo = this.promotionRepo.create({
      ...data,
      effectiveDate: data.effectiveDate || new Date().toISOString().split('T')[0],
      organizationId,
    });
    const saved = await this.promotionRepo.save(promo);

    // Update Employee basic salary & designation
    if (data.employeeId && data.newSalary) {
      await this.employeeRepo.update(
        { id: data.employeeId, organizationId },
        { basicSalary: data.newSalary },
      );
      await this.salaryStructureRepo.update(
        { employeeId: data.employeeId, organizationId },
        { basicSalary: data.newSalary },
      );
    }
    return saved;
  }

  // ================= 12. OFFBOARDING & CLEARANCES =================
  async submitResignation(data: Partial<ResignationClearance>, organizationId: string): Promise<ResignationClearance> {
    const clearance = this.clearanceRepo.create({
      ...data,
      status: ClearanceStatus.SUBMITTED,
      resignationDate: data.resignationDate || new Date().toISOString().split('T')[0],
      organizationId,
    });
    return this.clearanceRepo.save(clearance);
  }

  async getClearances(organizationId: string): Promise<ResignationClearance[]> {
    return this.clearanceRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: ['employee', 'employee.department'],
    });
  }

  async updateClearance(id: string, data: Partial<ResignationClearance>, organizationId: string): Promise<ResignationClearance> {
    const clr = await this.clearanceRepo.findOne({ where: { id, organizationId } });
    if (!clr) throw new NotFoundException('Clearance record not found');
    Object.assign(clr, data);
    return this.clearanceRepo.save(clr);
  }

  // ================= 13. SALARY STRUCTURE & PAYROLL GENERATION =================
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

  async getSalaryStructure(employeeId: string, organizationId: string) {
    return this.salaryStructureRepo.findOne({ where: { employeeId, organizationId } });
  }

  /**
   * Enterprise Payroll Auto-Generator:
   * Auto-calculates:
   * + Basic Salary & Allowances (HRA, Medical, Conveyance)
   * + Approved Sales Commissions
   * + Approved Expense Claim Reimbursements
   * - Tax & PF Deductions
   * - Active Loan / Salary Advance Monthly EMI Installments (and updates totalPaidAmount on the Loan)
   */
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

    // 1. Get approved commissions
    const commissions = await this.commissionRecordRepo.find({
      where: { organizationId, status: CommissionRecordStatus.APPROVED },
    });
    const commMap = new Map<string, number>();
    commissions.forEach((c) => {
      const current = commMap.get(c.employeeId) || 0;
      commMap.set(c.employeeId, current + Number(c.commissionAmount || 0));
    });

    // 2. Get approved expense claims for reimbursement
    const approvedExpenses = await this.expenseClaimRepo.find({
      where: { organizationId, status: ExpenseClaimStatus.APPROVED },
    });
    const expenseMap = new Map<string, number>();
    approvedExpenses.forEach((exp) => {
      const current = expenseMap.get(exp.employeeId) || 0;
      expenseMap.set(exp.employeeId, current + Number(exp.amount || 0));
    });

    // 3. Get active running loans for monthly EMI deduction
    const activeLoans = await this.loanRepo.find({
      where: { organizationId, status: LoanStatus.APPROVED },
    });
    const loanMap = new Map<string, { emi: number; loanId: string }>();
    activeLoans.forEach((l) => {
      const remaining = Number(l.principalAmount) - Number(l.totalPaidAmount);
      if (remaining > 0) {
        const emi = Math.min(Number(l.monthlyEmiAmount || 0), remaining);
        loanMap.set(l.employeeId, { emi, loanId: l.id });
      }
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
        const taxDeductions = Number(s?.taxDeduction || 0) + Number(s?.providentFundDeduction || 0);
        const comm = commMap.get(emp.id) || 0;
        const reimbursedExp = expenseMap.get(emp.id) || 0;
        const loanInfo = loanMap.get(emp.id);
        const loanEmi = loanInfo ? loanInfo.emi : 0;

        const totalDeductionsForEmp = taxDeductions + loanEmi;
        const net = basic + allowances + comm + reimbursedExp - totalDeductionsForEmp;

        totalGross += basic + allowances;
        totalDed += totalDeductionsForEmp;
        totalComm += comm;
        totalNet += net;

        const item = manager.create(PayrollItem, {
          payrollSheetId: savedSheet.id,
          employeeId: emp.id,
          basicSalary: basic,
          totalAllowances: allowances + reimbursedExp,
          commissionsEarned: comm,
          bonus: 0,
          unpaidLeaveDeductions: loanEmi,
          taxDeductions: taxDeductions,
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

    // Mark approved expense claims as reimbursed
    await this.expenseClaimRepo.update(
      { organizationId, status: ExpenseClaimStatus.APPROVED },
      { status: ExpenseClaimStatus.REIMBURSED },
    );

    return this.payrollSheetRepo.save(sheet);
  }

  async getPayrollSheets(organizationId: string) {
    return this.payrollSheetRepo.find({
      where: { organizationId },
      order: { year: 'DESC', month: 'DESC' },
      relations: ['items', 'items.employee', 'items.employee.department'],
    });
  }

  async getPayslip(payrollItemId: string, organizationId: string) {
    const item = await this.payrollItemRepo.findOne({
      where: { id: payrollItemId, organizationId },
      relations: ['payrollSheet', 'employee', 'employee.department', 'employee.designation'],
    });
    if (!item) throw new NotFoundException('Payroll record not found');

    const structure = await this.salaryStructureRepo.findOne({
      where: { employeeId: item.employeeId, organizationId },
    });

    return { payrollItem: item, structure };
  }

  // ================= 14. COMMISSIONS & TARGETS =================
  async createCommissionRule(data: Partial<CommissionRule>, organizationId: string): Promise<CommissionRule> {
    const rule = this.commissionRuleRepo.create({ ...data, organizationId });
    return this.commissionRuleRepo.save(rule);
  }

  async getCommissionRules(organizationId: string): Promise<CommissionRule[]> {
    return this.commissionRuleRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: ['specificEmployee'],
    });
  }

  async getCommissions(organizationId: string) {
    return this.commissionRecordRepo.find({
      where: { organizationId },
      order: { earnedDate: 'DESC' },
      relations: ['employee'],
    });
  }

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
