import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, MoreThanOrEqual, LessThanOrEqual, In, IsNull } from 'typeorm';
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
import { Holiday, HolidayApprovalStatus } from './entities/holiday.entity';
import { EmployeeAsset, AssetStatus } from './entities/employee-asset.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { PromotionHistory } from './entities/promotion-history.entity';
import { ResignationClearance, ClearanceStatus } from './entities/resignation-clearance.entity';
// New entity imports
import { EmployeeTimeline, TimelineEventType } from './entities/employee-timeline.entity';
import { SalaryHistory } from './entities/salary-history.entity';
import { AttendanceCorrection, CorrectionStatus } from './entities/attendance-correction.entity';
import { OvertimeRequest, OvertimeStatus } from './entities/overtime-request.entity';
import { EmployeeTransfer, TransferStatus } from './entities/employee-transfer.entity';
import { PerformanceReview, ReviewStatus } from './entities/performance-review.entity';
import { TrainingProgram, TrainingStatus } from './entities/training-program.entity';
import { TrainingEnrollment, EnrollmentStatus } from './entities/training-enrollment.entity';
import { DisciplinaryAction } from './entities/disciplinary-action.entity';
import { HrAnnouncement } from './entities/hr-announcement.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { ApprovalStage } from './entities/approval-stage.enum';
import { Users, UserRole } from '../user/entities/user.entity';
import { HrOffice } from './entities/office.entity';

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
    // New repositories
    @InjectRepository(EmployeeTimeline)
    private readonly timelineRepo: Repository<EmployeeTimeline>,
    @InjectRepository(SalaryHistory)
    private readonly salaryHistoryRepo: Repository<SalaryHistory>,
    @InjectRepository(AttendanceCorrection)
    private readonly correctionRepo: Repository<AttendanceCorrection>,
    @InjectRepository(OvertimeRequest)
    private readonly overtimeRepo: Repository<OvertimeRequest>,
    @InjectRepository(EmployeeTransfer)
    private readonly transferRepo: Repository<EmployeeTransfer>,
    @InjectRepository(PerformanceReview)
    private readonly performanceRepo: Repository<PerformanceReview>,
    @InjectRepository(TrainingProgram)
    private readonly trainingRepo: Repository<TrainingProgram>,
    @InjectRepository(TrainingEnrollment)
    private readonly enrollmentRepo: Repository<TrainingEnrollment>,
    @InjectRepository(DisciplinaryAction)
    private readonly disciplinaryRepo: Repository<DisciplinaryAction>,
    @InjectRepository(HrAnnouncement)
    private readonly announcementRepo: Repository<HrAnnouncement>,
    @InjectRepository(LoanRepayment)
    private readonly loanRepaymentRepo: Repository<LoanRepayment>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    @InjectRepository(HrOffice)
    private readonly officeRepo: Repository<HrOffice>,
  ) {}

  // All attendance date/time math is pinned to Asia/Dhaka explicitly rather than the
  // server process's OS timezone — the server happens to run in BDT today, but if this
  // ever gets deployed to a cloud VM (which typically default to UTC), relying on the
  // ambient timezone would silently shift every check-in/check-out by 6 hours.
  private static readonly BD_TIMEZONE = 'Asia/Dhaka';

  private getBangladeshDateTime(d: Date): { date: string; time: string } {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: HrPayrollService.BD_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(d).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}:${parts.second}`,
    };
  }

  private getBangladeshDateString(d: Date): string {
    return this.getBangladeshDateTime(d).date;
  }

  // Shared two-step approval chain (Department Head -> Final Approver) used by Leave,
  // Expense Claims, Overtime Requests and Attendance Corrections. Resolved dynamically
  // off the employee's CURRENT department/head rather than frozen at submit time, so an
  // org-chart change (e.g. new dept head) takes effect for any request still pending.
  private async resolveApprovalChain(
    employeeId: string,
    organizationId: string,
  ): Promise<{ stage: ApprovalStage; deptHeadEmployeeId: string | null }> {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId, organizationId } });
    const department = employee?.departmentId
      ? await this.departmentRepo.findOne({ where: { id: employee.departmentId, organizationId } })
      : null;
    const deptHeadEmployeeId = department?.headEmployeeId || null;

    // No department head configured, or the requester IS the department head — skip
    // straight to final approval instead of leaving the request stuck with no one to act.
    if (!deptHeadEmployeeId || deptHeadEmployeeId === employeeId) {
      return { stage: ApprovalStage.PENDING_FINAL, deptHeadEmployeeId: null };
    }
    return { stage: ApprovalStage.PENDING_DEPT_HEAD, deptHeadEmployeeId };
  }

  // Who is allowed to SEE which Leave/Expense/Overtime/Correction requests:
  // - Final Approver (CCO/CEO-level): everything, org-wide.
  // - Department Head: their own requests + everyone in the department(s) they head.
  // - Everyone else: only their own requests.
  private static readonly FULL_VISIBILITY_ROLES = ['admin', 'owner', 'super_admin', 'master_admin'];

  // Anyone whose LOGIN account carries an executive-tier role is automatically the
  // org-wide Final Approver — no per-employee configuration needed. The Employee-level
  // `isFinalApprover` flag still works too, as a manual override for anyone who should
  // have this power without necessarily holding one of these role names.
  private static readonly FINAL_APPROVER_ROLES = [UserRole.CEO, UserRole.CCO];

  private async isFinalApprover(employee: Employee | null): Promise<boolean> {
    if (!employee) return false;
    if (employee.isFinalApprover) return true;
    if (!employee.userId) return false;
    const user = await this.usersRepo.findOne({ where: { userId: employee.userId } });
    return !!user && HrPayrollService.FINAL_APPROVER_ROLES.includes(user.role);
  }

  private async resolveVisibilityScope(
    actingEmployeeId: string,
    organizationId: string,
    actingRole?: string,
  ): Promise<{ seeAll: boolean; employeeIds: string[] }> {
    // Org admins/owners get full oversight regardless of whether they're personally in
    // the approval chain — this does NOT let them approve on someone else's behalf,
    // approval authority is still checked strictly in assertAuthorizedApprover.
    if (actingRole && HrPayrollService.FULL_VISIBILITY_ROLES.includes(actingRole)) {
      return { seeAll: true, employeeIds: [] };
    }

    const actor = await this.employeeRepo.findOne({ where: { id: actingEmployeeId, organizationId } });
    if (await this.isFinalApprover(actor)) return { seeAll: true, employeeIds: [] };

    const headedDepartments = await this.departmentRepo.find({
      where: { organizationId, headEmployeeId: actingEmployeeId },
    });
    if (headedDepartments.length > 0) {
      const deptIds = headedDepartments.map((d) => d.id);
      const teamMembers = await this.employeeRepo.find({ where: { organizationId, departmentId: In(deptIds) } });
      const ids = new Set(teamMembers.map((e) => e.id));
      ids.add(actingEmployeeId);
      return { seeAll: false, employeeIds: Array.from(ids) };
    }

    return { seeAll: false, employeeIds: [actingEmployeeId] };
  }

  private async assertAuthorizedApprover(
    actingEmployeeId: string,
    organizationId: string,
    stage: ApprovalStage,
    deptHeadEmployeeId: string | null,
  ): Promise<void> {
    if (stage === ApprovalStage.PENDING_DEPT_HEAD) {
      if (actingEmployeeId !== deptHeadEmployeeId) {
        throw new ForbiddenException("Only this employee's Department Head can approve at this stage");
      }
      return;
    }
    const actor = await this.employeeRepo.findOne({ where: { id: actingEmployeeId, organizationId } });
    if (!(await this.isFinalApprover(actor))) {
      throw new ForbiddenException('Only a designated Final Approver can give final approval');
    }
  }

  // A single, cross-type inbox: everything currently sitting at a stage this specific
  // person is entitled to act on (Department Head for their team's Stage 1 items,
  // Final Approver for anyone's Stage 2 items) — not "everything visible to them"
  // (that's resolveVisibilityScope, used by the per-module HR list pages instead).
  async getApprovalCenterItems(organizationId: string, actingEmployeeId: string) {
    const actor = await this.employeeRepo.findOne({ where: { id: actingEmployeeId, organizationId } });
    if (!actor) return { items: [], isDeptHead: false, isFinalApprover: false, headedDepartments: [] };

    const headedDepartments = await this.departmentRepo.find({
      where: { organizationId, headEmployeeId: actingEmployeeId },
    });
    const headedDeptIds = headedDepartments.map((d) => d.id);
    const isFinal = await this.isFinalApprover(actor);
    const holidayRows = await this.holidayRepo.find({ where: { organizationId, approverEmployeeId: actingEmployeeId, approvalStatus: HolidayApprovalStatus.PENDING }, order: { createdAt: 'ASC' } });

    if (headedDeptIds.length === 0 && !isFinal) {
      return { items: holidayRows.map((holiday) => ({ id: holiday.id, requestType: 'holiday', approvalStage: 'PendingSelectedApprover', createdAt: holiday.createdAt, summary: `${holiday.name}: ${holiday.fromDate} ~ ${holiday.toDate}`, reason: holiday.description, holiday })), isDeptHead: false, isFinalApprover: false, headedDepartments: [] };
    }

    const stageConditionSql = (alias: string, empAlias: string, params: any) => {
      const conditions: string[] = [];
      if (headedDeptIds.length > 0) {
        conditions.push(`(${alias}.approvalStage = :deptStage AND ${empAlias}.departmentId IN (:...deptIds))`);
        params.deptStage = ApprovalStage.PENDING_DEPT_HEAD;
        params.deptIds = headedDeptIds;
      }
      if (isFinal) {
        conditions.push(`${alias}.approvalStage = :finalStage`);
        params.finalStage = ApprovalStage.PENDING_FINAL;
      }
      return conditions.join(' OR ');
    };

    const items: any[] = [];
    items.push(...holidayRows.map((holiday) => ({ id: holiday.id, requestType: 'holiday', approvalStage: 'PendingSelectedApprover', createdAt: holiday.createdAt, summary: `${holiday.name}: ${holiday.fromDate} ~ ${holiday.toDate}`, reason: holiday.description, holiday })));

    {
      const params: any = { organizationId, status: LeaveStatus.PENDING };
      const sql = stageConditionSql('lr', 'emp', params);
      const rows = await this.leaveRequestRepo.createQueryBuilder('lr')
        .leftJoinAndSelect('lr.employee', 'emp')
        .leftJoinAndSelect('emp.department', 'dept')
        .leftJoinAndSelect('lr.leaveType', 'lt')
        .where('lr.organizationId = :organizationId', { organizationId })
        .andWhere('lr.status = :status', { status: LeaveStatus.PENDING })
        .andWhere(`(${sql})`, params)
        .orderBy('lr.createdAt', 'ASC')
        .getMany();
      items.push(...rows.map((r) => ({
        id: r.id,
        requestType: 'leave',
        employee: r.employee,
        approvalStage: r.approvalStage,
        createdAt: r.createdAt,
        summary: `${r.leaveType?.name || 'Leave'}: ${r.startDate} ~ ${r.endDate} (${r.daysCount}d)`,
        reason: r.reason,
      })));
    }

    {
      const params: any = { organizationId, status: ExpenseClaimStatus.PENDING };
      const sql = stageConditionSql('claim', 'emp', params);
      const rows = await this.expenseClaimRepo.createQueryBuilder('claim')
        .leftJoinAndSelect('claim.employee', 'emp')
        .leftJoinAndSelect('emp.department', 'dept')
        .where('claim.organizationId = :organizationId', { organizationId })
        .andWhere('claim.status = :status', { status: ExpenseClaimStatus.PENDING })
        .andWhere(`(${sql})`, params)
        .orderBy('claim.createdAt', 'ASC')
        .getMany();
      items.push(...rows.map((r) => ({
        id: r.id,
        requestType: 'expense',
        employee: r.employee,
        approvalStage: r.approvalStage,
        createdAt: r.createdAt,
        summary: `${r.category}: ৳${Number(r.amount).toLocaleString()} on ${r.expenseDate}`,
        reason: r.description,
      })));
    }

    {
      const params: any = { organizationId, status: OvertimeStatus.PENDING };
      const sql = stageConditionSql('ot', 'emp', params);
      const rows = await this.overtimeRepo.createQueryBuilder('ot')
        .leftJoinAndSelect('ot.employee', 'emp')
        .leftJoinAndSelect('emp.department', 'dept')
        .where('ot.organizationId = :organizationId', { organizationId })
        .andWhere('ot.status = :status', { status: OvertimeStatus.PENDING })
        .andWhere(`(${sql})`, params)
        .orderBy('ot.createdAt', 'ASC')
        .getMany();
      items.push(...rows.map((r) => ({
        id: r.id,
        requestType: 'overtime',
        employee: r.employee,
        approvalStage: r.approvalStage,
        createdAt: r.createdAt,
        summary: `Overtime on ${r.overtimeDate}: ${r.requestedHours} hrs requested`,
        reason: r.reason,
      })));
    }

    {
      const params: any = { organizationId, status: CorrectionStatus.PENDING };
      const sql = stageConditionSql('c', 'emp', params);
      const rows = await this.correctionRepo.createQueryBuilder('c')
        .leftJoinAndSelect('c.employee', 'emp')
        .leftJoinAndSelect('emp.department', 'dept')
        .where('c.organizationId = :organizationId', { organizationId })
        .andWhere('c.status = :status', { status: CorrectionStatus.PENDING })
        .andWhere(`(${sql})`, params)
        .orderBy('c.createdAt', 'ASC')
        .getMany();
      items.push(...rows.map((r) => ({
        id: r.id,
        requestType: 'correction',
        employee: r.employee,
        approvalStage: r.approvalStage,
        createdAt: r.createdAt,
        summary: `Attendance correction for ${r.attendanceDate}`,
        reason: r.reason,
      })));
    }

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      items,
      isDeptHead: headedDeptIds.length > 0,
      isFinalApprover: isFinal,
      headedDepartments: headedDepartments.map((d) => d.name),
    };
  }

  // An employee's own assigned shift (day/night/etc.) takes priority; falls back to the
  // organization's single default shift when the employee has no shift assigned.
  private async resolveShiftForEmployee(employee: Employee, organizationId: string): Promise<WorkShift | null> {
    if (employee.workShiftId) {
      const assigned = await this.workShiftRepo.findOne({ where: { id: employee.workShiftId, organizationId } });
      if (assigned) return assigned;
    }
    return this.workShiftRepo.findOne({ where: { organizationId, isDefault: true } });
  }

  // ================= 1. DEPARTMENTS & DESIGNATIONS =================
  async createDepartment(data: Partial<Department>, organizationId: string): Promise<Department> {
    const dept = this.departmentRepo.create({ ...data, organizationId });
    return this.departmentRepo.save(dept);
  }

  async getDepartments(organizationId: string): Promise<Department[]> {
    return this.departmentRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
      relations: ['headEmployee'],
    });
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
    if (data.ipAddress) {
      const existing = await this.biometricDeviceRepo.findOne({
        where: { organizationId, ipAddress: data.ipAddress, port: data.port || 4370 },
      });
      if (existing) {
        throw new BadRequestException(
          `A device ("${existing.name}") is already registered at ${data.ipAddress}:${data.port || 4370}. Registering the same physical machine twice causes every punch to be counted double.`,
        );
      }
    }

    const generatedKey = `cbmnp_bio_${crypto.randomBytes(16).toString('hex')}`;
    const device = this.biometricDeviceRepo.create({
      ...data,
      apiKey: data.apiKey || generatedKey,
      organizationId,
    });
    return this.biometricDeviceRepo.save(device);
  }

  static readonly DEVICE_ONLINE_THRESHOLD_MS = 15 * 60 * 1000; // consider "online" if synced within last 15 mins

  async getBiometricDevices(organizationId: string): Promise<any[]> {
    const devices = await this.biometricDeviceRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return devices.map((device) => ({
      ...device,
      isOnline: this.isDeviceOnline(device),
    }));
  }

  private isDeviceOnline(device: BiometricDevice): boolean {
    if (!device.lastSyncAt) return false;
    return Date.now() - new Date(device.lastSyncAt).getTime() <= HrPayrollService.DEVICE_ONLINE_THRESHOLD_MS;
  }

  async getBiometricDeviceUsers(deviceId: string, organizationId: string, date?: string) {
    const device = await this.biometricDeviceRepo.findOne({ where: { id: deviceId, organizationId } });
    if (!device) throw new NotFoundException('Biometric device not found');

    const targetDate = date || this.getBangladeshDateString(new Date());
    const dayStart = new Date(`${targetDate}T00:00:00`);
    const dayEnd = new Date(`${targetDate}T23:59:59.999`);

    const logs = await this.punchLogRepo.find({
      where: {
        deviceId,
        organizationId,
        punchTime: Between(dayStart, dayEnd),
      },
      relations: ['matchedEmployee', 'matchedEmployee.department'],
      order: { punchTime: 'ASC' },
    });

    const byUser = new Map<string, any>();
    for (const log of logs) {
      const key = log.matchedEmployeeId || `unmatched:${log.biometricUserId}`;
      if (!byUser.has(key)) {
        byUser.set(key, {
          biometricUserId: log.biometricUserId,
          employee: log.matchedEmployee || null,
          matched: !!log.matchedEmployeeId,
          checkInTime: log.punchTime,
          checkOutTime: null,
          totalPunches: 0,
        });
      }
      const entry = byUser.get(key);
      entry.totalPunches += 1;
      if (log.punchTime < entry.checkInTime) entry.checkInTime = log.punchTime;
      if (log.punchTime > entry.checkInTime) entry.checkOutTime = log.punchTime;
    }

    const users = Array.from(byUser.values()).sort((a, b) =>
      (a.employee?.fullName || a.biometricUserId).localeCompare(b.employee?.fullName || b.biometricUserId),
    );

    return {
      device: { id: device.id, name: device.name, isOnline: this.isDeviceOnline(device), lastSyncAt: device.lastSyncAt },
      date: targetDate,
      totalPunchesToday: logs.length,
      users,
    };
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

    return this.ingestPunchLogs(device, organizationId, rawLogs);
  }

  // Shared by the webhook push endpoint (processBiometricSync) and the local network
  // poller (BiometricDevicePollerService) that pulls logs directly off a LAN device.
  async ingestPunchLogs(
    device: BiometricDevice | null,
    organizationId: string,
    rawLogs: Array<{
      biometricUserId: string;
      timestamp: string | Date;
      punchType?: string;
      verifyType?: string;
    }>,
  ) {
    let processedCount = 0;
    let matchedCount = 0;
    const results: any[] = [];

    for (const item of rawLogs) {
      if (!item.biometricUserId) continue;

      const punchDateObj = new Date(item.timestamp);
      const { date: attendanceDate, time: punchTimeStr } = this.getBangladeshDateTime(punchDateObj);

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
        const shift = await this.resolveShiftForEmployee(employee, organizationId);
        const shiftStartTime = shift?.startTime || '09:00:00';
        const graceMinutes = shift?.graceMinutes !== undefined ? shift.graceMinutes : 15;
        const standardHours = shift?.fullDayHours || 8;

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

  // Cross-references a device's raw enrolled-user roster (deviceUserId, name) against
  // our employees table so the UI can show which device users are mapped to real staff.
  async attachEmployeeMapping(
    users: Array<{ deviceUserId: string; name: string; cardNumber?: number | null }>,
    organizationId: string,
  ) {
    if (users.length === 0) return [];
    const ids = users.map((u) => u.deviceUserId).filter(Boolean);
    const employees = await this.employeeRepo.find({
      where: [
        { organizationId, biometricUserId: In(ids) },
        { organizationId, employeeCode: In(ids) },
      ],
      relations: ['department'],
    });
    const byId = new Map<string, Employee>();
    for (const emp of employees) {
      if (emp.biometricUserId) byId.set(emp.biometricUserId, emp);
      if (emp.employeeCode) byId.set(emp.employeeCode, emp);
    }
    return users.map((u) => ({
      ...u,
      employee: byId.get(u.deviceUserId) || null,
      matched: byId.has(u.deviceUserId),
    }));
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

  async approveHoliday(id: string, approved: boolean, remarks: string, organizationId: string, actingEmployeeId: string) {
    const holiday = await this.holidayRepo.findOne({ where: { id, organizationId } });
    if (!holiday) throw new NotFoundException('Holiday request not found');
    if (holiday.approvalStatus !== HolidayApprovalStatus.PENDING) throw new BadRequestException('This holiday request has already been decided');
    if (holiday.approverEmployeeId !== actingEmployeeId) throw new ForbiddenException('This holiday request is assigned to another approver');
    holiday.approvalStatus = approved ? HolidayApprovalStatus.APPROVED : HolidayApprovalStatus.REJECTED;
    holiday.approvedByEmployeeId = actingEmployeeId;
    holiday.approvalRemarks = remarks || null;
    return this.holidayRepo.save(holiday);
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

    if (data.userId) {
      const existingLogin = await this.employeeRepo.findOne({ where: { organizationId, userId: data.userId } });
      if (existingLogin) {
        throw new BadRequestException(`This login account is already linked to ${existingLogin.fullName}`);
      }
    }

    const emp = this.employeeRepo.create({ ...data, organizationId });
    const saved = await this.employeeRepo.save(emp);

    if (saved.biometricUserId) {
      await this.backfillAttendanceFromUnmatchedPunches(saved, organizationId);
    }

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

    if (data.userId && data.userId !== emp.userId) {
      const existingLogin = await this.employeeRepo.findOne({ where: { organizationId, userId: data.userId } });
      if (existingLogin && existingLogin.id !== id) {
        throw new BadRequestException(`This login account is already linked to ${existingLogin.fullName}`);
      }
    }

    const biometricIdChanged = data.biometricUserId && data.biometricUserId !== emp.biometricUserId;
    Object.assign(emp, data);
    const saved = await this.employeeRepo.save(emp);

    if (biometricIdChanged) {
      await this.backfillAttendanceFromUnmatchedPunches(saved, organizationId);
    }

    return saved;
  }

  // Employee-matching for biometric punches only runs once, at ingestion time. If a punch
  // arrives before an employee's Biometric ID is mapped in the ERP, it's stored as
  // "unmatched" and silently never becomes attendance. Whenever a Biometric ID gets
  // (re)assigned, re-scan any already-stored unmatched logs for that ID and turn them
  // into real attendance records — otherwise historical punches are lost forever.
  private async backfillAttendanceFromUnmatchedPunches(employee: Employee, organizationId: string) {
    const candidateIds = [employee.biometricUserId, employee.employeeCode].filter(Boolean) as string[];
    if (candidateIds.length === 0) return { matchedLogs: 0, backfilledDates: 0 };

    const unmatchedLogs = await this.punchLogRepo.find({
      where: { organizationId, biometricUserId: In(candidateIds), matchedEmployeeId: IsNull() },
      order: { punchTime: 'ASC' },
    });
    if (unmatchedLogs.length === 0) return { matchedLogs: 0, backfilledDates: 0 };

    await this.punchLogRepo.update(
      { id: In(unmatchedLogs.map((l) => l.id)) },
      { matchedEmployeeId: employee.id },
    );

    const byDate = new Map<string, Date[]>();
    for (const log of unmatchedLogs) {
      const date = this.getBangladeshDateString(log.punchTime);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(log.punchTime);
    }

    const shift = await this.resolveShiftForEmployee(employee, organizationId);
    const shiftStartTime = shift?.startTime || '09:00:00';
    const graceMinutes = shift?.graceMinutes ?? 15;
    const standardHours = shift?.fullDayHours || 8;

    for (const [attendanceDate, punchTimes] of byDate) {
      punchTimes.sort((a, b) => a.getTime() - b.getTime());
      const { time: clockInStr } = this.getBangladeshDateTime(punchTimes[0]);

      let record = await this.attendanceRepo.findOne({
        where: { organizationId, employeeId: employee.id, attendanceDate },
      });

      if (!record) {
        const [sH, sM] = shiftStartTime.split(':').map(Number);
        const [pH, pM] = clockInStr.split(':').map(Number);
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
          clockInTime: clockInStr,
          status,
          lateMinutes: lateMins,
          punchSource: PunchSource.BIOMETRIC,
          remarks: 'Backfilled after Biometric ID was mapped to this employee',
          organizationId,
        });
      }

      if (punchTimes.length > 1) {
        const { time: clockOutStr } = this.getBangladeshDateTime(punchTimes[punchTimes.length - 1]);
        record.clockOutTime = clockOutStr;
        record.punchSource = PunchSource.BIOMETRIC;
        if (record.clockInTime) {
          const [inH, inM, inS] = record.clockInTime.split(':').map(Number);
          const [outH, outM, outS] = clockOutStr.split(':').map(Number);
          const totalSecs = (outH * 3600 + outM * 60 + (outS || 0)) - (inH * 3600 + inM * 60 + (inS || 0));
          record.workHours = Math.max(0, Number((totalSecs / 3600).toFixed(2)));
          if (record.workHours > standardHours) {
            record.overtimeMinutes = Math.round((record.workHours - standardHours) * 60);
          }
        }
      }

      await this.attendanceRepo.save(record);
    }

    return { matchedLogs: unmatchedLogs.length, backfilledDates: byDate.size };
  }

  // Resolves the Employee profile linked to a logged-in Users account (JWT `userId`
  // claim) — used to figure out "which employee is actually clicking Approve" for the
  // Department Head / Final Approver checks.
  async getEmployeeByUserId(userId: string, organizationId: string): Promise<Employee | null> {
    if (!userId) return null;
    return this.employeeRepo.findOne({
      where: { userId, organizationId },
      relations: ['department', 'designation', 'reportingManager', 'office'],
    });
  }

  async getSelfServiceProfile(userId: string, organizationId: string) {
    const employee = await this.getEmployeeByUserId(userId, organizationId);
    const user = await this.usersRepo.findOne({ where: { userId, organizationId } });
    const profile = user ? { name: user.name, email: user.email, phone: user.phone, address: user.address, role: user.role } : null;
    if (!employee) return { user: profile, employee: null, attendance: [], leaves: [], holidays: [], leaveBalances: [] };

    const [attendance, leaves, leaveBalances, holidays] = await Promise.all([
      this.attendanceRepo.find({
        where: { organizationId, employeeId: employee.id },
        order: { attendanceDate: 'DESC' },
        take: 90,
      }),
      this.leaveRequestRepo.find({
        where: { organizationId, employeeId: employee.id },
        relations: ['leaveType'],
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.getLeaveBalances(employee.id, organizationId),
      this.holidayRepo.find({ where: { organizationId, approvalStatus: HolidayApprovalStatus.APPROVED }, order: { fromDate: 'ASC' } }),
    ]);
    const approverIds = Array.from(new Set(leaves.flatMap((leave) => [leave.deptHeadApprovedById, leave.approvedById]).filter(Boolean)));
    const approvers = approverIds.length
      ? await this.employeeRepo.find({ where: { organizationId, id: In(approverIds) }, relations: ['designation'] })
      : [];
    const approverDetails = new Map(approvers.map((approver) => [approver.id, { name: approver.fullName, title: approver.designation?.name || 'Approver' }]));
    const department = employee.departmentId
      ? await this.departmentRepo.findOne({ where: { id: employee.departmentId, organizationId }, relations: ['headEmployee', 'headEmployee.designation'] })
      : null;
    // The final approver can be set either on the Employee profile or by assigning the
    // linked ERP user the CEO/CCO role. Resolve the name here so self-service users see
    // a person, not just the generic "Final Approver" label.
    const organizationEmployees = await this.employeeRepo.find({
      where: { organizationId },
      relations: ['user', 'designation'],
    });
    const finalApprover = organizationEmployees.find((candidate) =>
      candidate.isFinalApprover ||
      (candidate.user && HrPayrollService.FINAL_APPROVER_ROLES.includes(candidate.user.role)),
    );
    const enhancedLeaves = leaves.map((leave) => ({
      ...leave,
      approvalInfo: {
        currentWith: leave.status === LeaveStatus.PENDING
          ? leave.approvalStage === ApprovalStage.PENDING_DEPT_HEAD
            ? { name: department?.headEmployee?.fullName || 'Department Head not configured', title: department?.headEmployee?.designation?.name || 'Department Head' }
            : { name: finalApprover?.fullName || 'Final Approver not configured', title: finalApprover?.designation?.name || 'Final Approver' }
          : null,
        departmentHeadApprovedBy: leave.deptHeadApprovedById ? approverDetails.get(leave.deptHeadApprovedById) || { name: 'Department Head', title: 'Department Head' } : null,
        finalApprovedBy: leave.approvedById ? approverDetails.get(leave.approvedById) || { name: 'Final Approver', title: 'Final Approver' } : null,
      },
    }));
    return { user: profile, employee, attendance, leaves: enhancedLeaves, holidays, leaveBalances };
  }

  async deleteEmployee(id: string, organizationId: string): Promise<{ success: boolean }> {
    const emp = await this.employeeRepo.findOne({ where: { id, organizationId } });
    if (!emp) throw new NotFoundException('Employee not found');
    await this.employeeRepo.remove(emp);
    return { success: true };
  }

  async getOffices(organizationId: string) { return this.officeRepo.find({ where: { organizationId }, order: { name: 'ASC' } }); }
  async createOffice(data: Partial<HrOffice>, organizationId: string) { return this.officeRepo.save(this.officeRepo.create({ ...data, organizationId })); }
  async updateOffice(id: string, data: Partial<HrOffice>, organizationId: string) {
    const office = await this.officeRepo.findOne({ where: { id, organizationId } });
    if (!office) throw new NotFoundException('Office not found');
    Object.assign(office, data);
    return this.officeRepo.save(office);
  }

  private async validateOfficeRange(organizationId: string, officeId?: string, latitude?: number, longitude?: number) {
    // Browser/manual attendance is only allowed against the employee's assigned,
    // active office. Biometric sync uses a separate path and deliberately bypasses it.
    if (!officeId) throw new BadRequestException('No office is assigned to your employee profile. Contact HR.');
    const offices = await this.officeRepo.find({ where: { organizationId, id: officeId, isActive: true } });
    if (!offices.length) throw new BadRequestException('Your assigned office is inactive or unavailable. Contact HR.');
    if (latitude === undefined || longitude === undefined) throw new BadRequestException('Location permission is required for attendance.');
    const toRad = (value: number) => value * Math.PI / 180;
    const matched = offices.find((office) => {
      const lat1 = Number(office.latitude), lng1 = Number(office.longitude);
      const a = Math.sin(toRad(latitude - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(latitude)) * Math.sin(toRad(longitude - lng1) / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= office.radiusMeters;
    });
    if (!matched) throw new BadRequestException('You are outside the allowed office attendance range.');
  }

  // ================= 5. ATTENDANCE & ROSTER =================
  async clockIn(employeeId: string, organizationId: string, latitude?: number, longitude?: number, remarks?: string): Promise<AttendanceRecord> {
    const now = new Date();
    const { date: today, time: timeStr } = this.getBangladeshDateTime(now);

    const employee = await this.employeeRepo.findOne({ where: { id: employeeId, organizationId } });
    if (!employee) throw new NotFoundException('Employee not found');
    await this.validateOfficeRange(organizationId, employee.officeId, latitude, longitude);

    let record = await this.attendanceRepo.findOne({
      where: { organizationId, employeeId, attendanceDate: today },
    });
    // Attendance is the source of truth. A real punch on an approved-leave day
    // automatically rejects that leave; balances are calculated from Approved leaves,
    // so the day is immediately returned to the employee's available balance.
    const overlappingLeaves = await this.leaveRequestRepo.createQueryBuilder('leave')
      .where('leave.organizationId = :organizationId', { organizationId })
      .andWhere('leave.employeeId = :employeeId', { employeeId })
      .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('leave.startDate <= :today', { today })
      .andWhere('leave.endDate >= :today', { today })
      .getMany();
    for (const leave of overlappingLeaves) {
      leave.status = LeaveStatus.REJECTED;
      leave.approvalRemarks = [leave.approvalRemarks, `Automatically rejected: employee checked in on ${today}.`].filter(Boolean).join(' ');
    }
    if (overlappingLeaves.length) await this.leaveRequestRepo.save(overlappingLeaves);

    const canReplaceAutoRecord = record && [AttendanceStatus.ON_LEAVE, AttendanceStatus.ABSENT].includes(record.status);
    if (record && !canReplaceAutoRecord) throw new BadRequestException('Employee already clocked in today');

    const shift = await this.resolveShiftForEmployee(employee, organizationId);
    const shiftStartTime = shift?.startTime || '09:00:00';
    const graceMinutes = shift?.graceMinutes !== undefined ? shift.graceMinutes : 15;

    const [sH, sM] = shiftStartTime.split(':').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const shiftMinutes = sH * 60 + sM + graceMinutes;
    const punchMinutes = hours * 60 + minutes;

    let lateMins = 0;
    let status = AttendanceStatus.PRESENT;
    if (punchMinutes > shiftMinutes) {
      lateMins = punchMinutes - (sH * 60 + sM);
      status = AttendanceStatus.LATE;
    }

    record = record
      ? this.attendanceRepo.merge(record, { clockInTime: timeStr, clockOutTime: null, workHours: null, status, lateMinutes: lateMins, punchSource: PunchSource.WEB_MANUAL, remarks: remarks || record.remarks || null })
      : this.attendanceRepo.create({ employeeId, attendanceDate: today, clockInTime: timeStr, status, lateMinutes: lateMins, punchSource: PunchSource.WEB_MANUAL, remarks: remarks || null, organizationId });
    return this.attendanceRepo.save(record);
  }

  async clockOut(employeeId: string, organizationId: string, latitude?: number, longitude?: number, remarks?: string): Promise<AttendanceRecord> {
    const now = new Date();
    const { date: today, time: timeStr } = this.getBangladeshDateTime(now);

    const record = await this.attendanceRepo.findOne({
      where: { organizationId, employeeId, attendanceDate: today },
    });
    if (!record) throw new NotFoundException('Clock-in record not found for today');
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId, organizationId } });
    await this.validateOfficeRange(organizationId, employee?.officeId, latitude, longitude);

    record.clockOutTime = timeStr;
    if (remarks) record.remarks = record.remarks ? `${record.remarks} | Check-out: ${remarks}` : `Check-out: ${remarks}`;
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
    // Single-day roster view: show EVERY active employee for that date, not just the
    // ones who happen to have a punch — otherwise anyone who forgot to punch (or whose
    // device was offline) simply vanishes from the list instead of showing as Absent.
    if (params?.date && !params?.month && !params?.year) {
      return this.getDailyRosterWithAbsentees(organizationId, params.date, params.departmentId, params.employeeId);
    }

    const query = this.attendanceRepo.createQueryBuilder('att')
      .leftJoinAndSelect('att.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .leftJoinAndSelect('att.device', 'dev')
      .where('att.organizationId = :organizationId', { organizationId });

    if (params?.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
    if (params?.employeeId) query.andWhere('att.employeeId = :empId', { empId: params.employeeId });

    query.orderBy('att.attendanceDate', 'DESC').addOrderBy('att.clockInTime', 'ASC');
    return query.getMany();
  }

  private async getDailyRosterWithAbsentees(
    organizationId: string,
    date: string,
    departmentId?: string,
    employeeId?: string,
  ) {
    const empWhere: any = { organizationId, status: EmploymentStatus.ACTIVE };
    if (departmentId) empWhere.departmentId = departmentId;
    if (employeeId) empWhere.id = employeeId;

    const [employees, records, approvedLeaves] = await Promise.all([
      this.employeeRepo.find({ where: empWhere, relations: ['department'] }),
      this.attendanceRepo.find({
        where: { organizationId, attendanceDate: date },
        relations: ['employee', 'employee.department', 'device'],
      }),
      this.leaveRequestRepo.find({
        where: { organizationId, status: LeaveStatus.APPROVED, startDate: LessThanOrEqual(date), endDate: MoreThanOrEqual(date) },
      }),
    ]);

    const recordByEmployeeId = new Map(records.map((r) => [r.employeeId, r]));
    const onLeaveEmployeeIds = new Set(approvedLeaves.map((l) => l.employeeId));

    const roster = employees.map((emp) => {
      const existing = recordByEmployeeId.get(emp.id);
      if (existing) return existing;

      return {
        id: `absent-${emp.id}-${date}`,
        employeeId: emp.id,
        employee: emp,
        attendanceDate: date,
        clockInTime: null,
        clockOutTime: null,
        status: onLeaveEmployeeIds.has(emp.id) ? AttendanceStatus.ON_LEAVE : AttendanceStatus.ABSENT,
        lateMinutes: 0,
        earlyLeavingMinutes: 0,
        workHours: 0,
        overtimeMinutes: 0,
        punchSource: null,
        deviceId: null,
        device: null,
        remarks: onLeaveEmployeeIds.has(emp.id) ? 'On approved leave' : 'No punch recorded yet',
        organizationId,
        isSynthesized: true,
      } as unknown as AttendanceRecord;
    });

    return roster.sort((a, b) => (a.employee?.fullName || '').localeCompare(b.employee?.fullName || ''));
  }

  async getAttendanceSummary(organizationId: string, date?: string) {
    const targetDate = date || this.getBangladeshDateString(new Date());
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

    // Balance enforcement: check if employee has enough remaining days for this leave type
    const balances = await this.getLeaveBalances(data.employeeId!, organizationId);
    const balance = balances.find(b => b.leaveTypeId === data.leaveTypeId);
    if (!balance) {
      throw new BadRequestException('Leave type not found for this organization');
    }
    if (balance.remainingDays < days) {
      throw new BadRequestException(
        `Insufficient leave balance. ${balance.leaveTypeName} remaining: ${balance.remainingDays} days, requested: ${days} days.`,
      );
    }

    const { stage } = await this.resolveApprovalChain(data.employeeId, organizationId);
    const req = this.leaveRequestRepo.create({
      ...data,
      daysCount: days || 1,
      status: LeaveStatus.PENDING,
      approvalStage: stage,
      organizationId,
    });
    return this.leaveRequestRepo.save(req);
  }

  async approveLeave(requestId: string, approved: boolean, remarks: string, organizationId: string, actingEmployeeId: string) {
    const req = await this.leaveRequestRepo.findOne({ where: { id: requestId, organizationId } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== LeaveStatus.PENDING) throw new BadRequestException('This leave request has already been decided');

    const { deptHeadEmployeeId } = await this.resolveApprovalChain(req.employeeId, organizationId);
    await this.assertAuthorizedApprover(actingEmployeeId, organizationId, req.approvalStage, deptHeadEmployeeId);

    if (!approved) {
      req.status = LeaveStatus.REJECTED;
      req.approvedById = actingEmployeeId;
      req.approvalRemarks = remarks;
      return this.leaveRequestRepo.save(req);
    }

    if (req.approvalStage === ApprovalStage.PENDING_DEPT_HEAD) {
      req.deptHeadApprovedById = actingEmployeeId;
      req.deptHeadActionAt = new Date();
      req.deptHeadRemarks = remarks;
      req.approvalStage = ApprovalStage.PENDING_FINAL;
      return this.leaveRequestRepo.save(req);
    }

    req.status = LeaveStatus.APPROVED;
    req.approvedById = actingEmployeeId;
    req.approvalRemarks = remarks;
    return this.leaveRequestRepo.save(req);
  }

  async getLeaveRequests(organizationId: string, actingEmployeeId: string, employeeId?: string, status?: string, actingRole?: string) {
    const query = this.leaveRequestRepo.createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .where('lr.organizationId = :organizationId', { organizationId });

    const scope = await this.resolveVisibilityScope(actingEmployeeId, organizationId, actingRole);
    if (!scope.seeAll) {
      query.andWhere('lr.employeeId IN (:...visibleIds)', { visibleIds: scope.employeeIds.length ? scope.employeeIds : ['__none__'] });
    }

    if (employeeId) query.andWhere('lr.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('lr.status = :status', { status });
    query.orderBy('lr.createdAt', 'DESC');
    return query.getMany();
  }

  async getLeaveBalances(employeeId: string, organizationId: string) {
    const [employee, leaveTypes, approvedRequests] = await Promise.all([
      this.employeeRepo.findOne({ where: { id: employeeId, organizationId } }),
      this.leaveTypeRepo.find({ where: { organizationId, isActive: true } }),
      this.leaveRequestRepo.find({
        where: { employeeId, organizationId, status: LeaveStatus.APPROVED },
      }),
    ]);

    const employeeQuota = employee?.customLeaveQuota ?? null;

    return leaveTypes.map(lt => {
      const usedDays = approvedRequests
        .filter(r => r.leaveTypeId === lt.id)
        .reduce((sum, r) => sum + (r.daysCount || 0), 0);
      // If employee has a custom quota set, use it; otherwise fall back to leave type default
      const totalAllowed = employeeQuota !== null ? employeeQuota : (lt.daysAllowedPerYear || 14);
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
    const { stage } = await this.resolveApprovalChain(data.employeeId, organizationId);
    const claim = this.expenseClaimRepo.create({
      ...data,
      status: ExpenseClaimStatus.PENDING,
      approvalStage: stage,
      organizationId,
    });
    return this.expenseClaimRepo.save(claim);
  }

  async getExpenseClaims(organizationId: string, actingEmployeeId: string, employeeId?: string, status?: string, actingRole?: string): Promise<ExpenseClaim[]> {
    const query = this.expenseClaimRepo.createQueryBuilder('claim')
      .leftJoinAndSelect('claim.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('claim.organizationId = :organizationId', { organizationId });

    const scope = await this.resolveVisibilityScope(actingEmployeeId, organizationId, actingRole);
    if (!scope.seeAll) {
      query.andWhere('claim.employeeId IN (:...visibleIds)', { visibleIds: scope.employeeIds.length ? scope.employeeIds : ['__none__'] });
    }

    if (employeeId) query.andWhere('claim.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('claim.status = :status', { status });
    query.orderBy('claim.expenseDate', 'DESC');
    return query.getMany();
  }

  async approveExpenseClaim(id: string, approved: boolean, remarks: string, organizationId: string, actingEmployeeId: string) {
    const claim = await this.expenseClaimRepo.findOne({ where: { id, organizationId } });
    if (!claim) throw new NotFoundException('Expense claim not found');
    if (claim.status !== ExpenseClaimStatus.PENDING) throw new BadRequestException('This expense claim has already been decided');

    const { deptHeadEmployeeId } = await this.resolveApprovalChain(claim.employeeId, organizationId);
    await this.assertAuthorizedApprover(actingEmployeeId, organizationId, claim.approvalStage, deptHeadEmployeeId);

    if (!approved) {
      claim.status = ExpenseClaimStatus.REJECTED;
      claim.approvedById = actingEmployeeId;
      claim.remarks = remarks;
      return this.expenseClaimRepo.save(claim);
    }

    if (claim.approvalStage === ApprovalStage.PENDING_DEPT_HEAD) {
      claim.deptHeadApprovedById = actingEmployeeId;
      claim.deptHeadActionAt = new Date();
      claim.deptHeadRemarks = remarks;
      claim.approvalStage = ApprovalStage.PENDING_FINAL;
      return this.expenseClaimRepo.save(claim);
    }

    claim.status = ExpenseClaimStatus.APPROVED;
    claim.approvedById = actingEmployeeId;
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
  async generatePayroll(year: number, month: number, organizationId: string, departmentId?: string): Promise<PayrollSheet> {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const sheetName = `Payroll - ${monthNames[month - 1]} ${year}`;

    const existing = await this.payrollSheetRepo.findOne({
      where: { organizationId, year, month, departmentId: departmentId || null },
    });
    if (existing) {
      throw new BadRequestException(`Payroll sheet for ${monthNames[month - 1]} ${year} already generated`);
    }

    const employees = await this.employeeRepo.find({
      where: { organizationId, status: EmploymentStatus.ACTIVE, ...(departmentId ? { departmentId } : {}) },
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
        departmentId: departmentId || null,
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

  // ================= 15. HR DASHBOARD =================
  async getDashboardSummary(organizationId: string) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Run each query safely so one failure doesn't crash the whole dashboard
    const safeCount = async (fn: () => Promise<number>): Promise<number> => {
      try { return await fn(); } catch { return 0; }
    };
    const safeFind = async <T>(fn: () => Promise<T[]>): Promise<T[]> => {
      try { return await fn(); } catch { return []; }
    };

    const [
      totalEmployees,
      activeEmployees,
      probationEmployees,
      pendingLeaves,
      pendingLoans,
      openJobs,
      pendingPayroll,
      pendingCorrections,
      pendingOvertimes,
    ] = await Promise.all([
      safeCount(() => this.employeeRepo.count({ where: { organizationId } })),
      safeCount(() => this.employeeRepo.count({ where: { organizationId, status: EmploymentStatus.ACTIVE } })),
      safeCount(() => this.employeeRepo.count({ where: { organizationId, status: EmploymentStatus.PROBATION } })),
      safeCount(() => this.leaveRequestRepo.count({ where: { organizationId, status: LeaveStatus.PENDING } })),
      safeCount(() => this.loanRepo.count({ where: { organizationId, status: LoanStatus.PENDING } })),
      safeCount(() => this.jobOpeningRepo.count({ where: { organizationId } })),
      safeCount(() => this.payrollSheetRepo.count({ where: { organizationId, status: PayrollStatus.DRAFT } })),
      safeCount(() => this.correctionRepo.count({ where: { organizationId, status: CorrectionStatus.PENDING } })),
      safeCount(() => this.overtimeRepo.count({ where: { organizationId, status: OvertimeStatus.PENDING } })),
    ]);

    const onLeaveToday = await safeCount(() =>
      this.leaveRequestRepo.createQueryBuilder('leave')
        .where('leave.organizationId = :organizationId', { organizationId })
        .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
        .andWhere('leave.startDate <= :today', { today })
        .andWhere('leave.endDate >= :today', { today })
        .getCount()
    );

    // Today attendance — fetch all, no take limit
    const todayAttendance = await safeFind(() =>
      this.attendanceRepo.find({ where: { organizationId, attendanceDate: today } })
    );
    const presentToday = todayAttendance.filter(r => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE).length;
    const lateToday = todayAttendance.filter(r => r.status === AttendanceStatus.LATE).length;

    // Recent joiners
    const recentJoiners = await safeFind(() =>
      this.employeeRepo.find({
        where: { organizationId },
        order: { joiningDate: 'DESC' },
        take: 5,
        relations: ['department', 'designation'],
      })
    );

    // Upcoming birthdays in next 7 days
    const allEmp = await safeFind(() =>
      this.employeeRepo.find({ where: { organizationId, status: EmploymentStatus.ACTIVE } })
    );
    const upcomingBirthdays = allEmp
      .filter(e => {
        if (!e.dateOfBirth) return false;
        try {
          const bday = new Date(e.dateOfBirth);
          const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
          const diff = (thisYearBday.getTime() - now.getTime()) / (1000 * 3600 * 24);
          return diff >= 0 && diff <= 30;
        } catch { return false; }
      })
      .map(e => ({ id: e.id, name: e.fullName, dateOfBirth: e.dateOfBirth, department: (e as any).department?.name }));

    // Expiring probations in next 30 days
    const expiringProbations = await safeFind(() =>
      this.employeeRepo
        .createQueryBuilder('emp')
        .where('emp.organizationId = :organizationId', { organizationId })
        .andWhere('emp.probationEndDate IS NOT NULL')
        .andWhere('emp.probationEndDate >= :today', { today })
        .andWhere('emp.probationEndDate <= :nextMonth', {
          nextMonth: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split('T')[0],
        })
        .select(['emp.id', 'emp.fullName', 'emp.probationEndDate'])
        .getMany()
    );

    // Dept headcount
    const departmentBreakdown = await safeFind(() =>
      this.employeeRepo
        .createQueryBuilder('emp')
        .leftJoin('emp.department', 'dept')
        .select('dept.name', 'department')
        .addSelect('COUNT(emp.id)', 'count')
        .where('emp.organizationId = :organizationId', { organizationId })
        .andWhere('emp.status = :status', { status: EmploymentStatus.ACTIVE })
        .groupBy('dept.name')
        .getRawMany()
    );

    return {
      totalEmployees,
      activeEmployees,
      probationEmployees,
      presentToday,
      lateToday,
      onLeaveToday,
      absentToday: Math.max(0, activeEmployees - presentToday - onLeaveToday),
      pendingLeaves,
      pendingLoans,
      pendingCorrections,
      pendingOvertimes,
      pendingPayroll,
      openJobs,
      recentJoiners,
      upcomingBirthdays,
      probationExpiring: expiringProbations,
      departmentBreakdown,
    };
  }

  // ================= 16. EMPLOYEE TIMELINE =================
  async recordTimelineEvent(data: Partial<EmployeeTimeline>, organizationId: string): Promise<EmployeeTimeline> {
    const event = this.timelineRepo.create({ ...data, organizationId });
    return this.timelineRepo.save(event);
  }

  async getEmployeeTimeline(employeeId: string, organizationId: string): Promise<EmployeeTimeline[]> {
    return this.timelineRepo.find({
      where: { employeeId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  // ================= 17. SALARY HISTORY & REVISIONS =================
  async addSalaryRevision(data: {
    employeeId: string;
    newBasicSalary: number;
    effectiveDate: string;
    revisionType?: string;
    reason?: string;
    approvedByUserId?: string;
    approvedByName?: string;
  }, organizationId: string): Promise<SalaryHistory> {
    const emp = await this.employeeRepo.findOne({ where: { id: data.employeeId, organizationId } });
    if (!emp) throw new NotFoundException('Employee not found');

    const struct = await this.salaryStructureRepo.findOne({ where: { employeeId: data.employeeId, organizationId } });
    const prevBasic = Number(emp.basicSalary || 0);
    const prevGross = prevBasic + Number(struct?.houseRentAllowance || 0) + Number(struct?.medicalAllowance || 0) + Number(struct?.conveyanceAllowance || 0);
    const newGross = Number(data.newBasicSalary) + Number(struct?.houseRentAllowance || 0) + Number(struct?.medicalAllowance || 0) + Number(struct?.conveyanceAllowance || 0);

    const history = this.salaryHistoryRepo.create({
      employeeId: data.employeeId,
      previousBasicSalary: prevBasic,
      newBasicSalary: data.newBasicSalary,
      previousGrossSalary: prevGross,
      newGrossSalary: newGross,
      incrementAmount: Number(data.newBasicSalary) - prevBasic,
      incrementPercentage: prevBasic > 0 ? Number((((Number(data.newBasicSalary) - prevBasic) / prevBasic) * 100).toFixed(2)) : 0,
      effectiveDate: data.effectiveDate,
      revisionType: data.revisionType || 'Increment',
      reason: data.reason,
      approvedByUserId: data.approvedByUserId,
      approvedByName: data.approvedByName,
      organizationId,
    });
    const saved = await this.salaryHistoryRepo.save(history);

    // Update employee and salary structure
    await this.employeeRepo.update({ id: data.employeeId, organizationId }, { basicSalary: data.newBasicSalary });
    if (struct) {
      struct.basicSalary = data.newBasicSalary;
      await this.salaryStructureRepo.save(struct);
    }

    // Add to timeline
    await this.recordTimelineEvent({
      employeeId: data.employeeId,
      eventType: TimelineEventType.SALARY_REVISION,
      title: `Salary Revised: ৳${prevBasic.toLocaleString()} → ৳${Number(data.newBasicSalary).toLocaleString()}`,
      description: data.reason,
      eventDate: data.effectiveDate,
      metadata: { previousBasicSalary: prevBasic, newBasicSalary: data.newBasicSalary, incrementAmount: Number(data.newBasicSalary) - prevBasic },
      performedByName: data.approvedByName,
      performedByUserId: data.approvedByUserId,
    }, organizationId);

    return saved;
  }

  async getSalaryHistory(employeeId: string, organizationId: string): Promise<SalaryHistory[]> {
    return this.salaryHistoryRepo.find({
      where: { employeeId, organizationId },
      order: { effectiveDate: 'DESC' },
    });
  }

  // ================= 18. ATTENDANCE CORRECTIONS =================
  async submitAttendanceCorrection(data: Partial<AttendanceCorrection>, organizationId: string): Promise<AttendanceCorrection> {
    const { stage } = await this.resolveApprovalChain(data.employeeId, organizationId);
    const correction = this.correctionRepo.create({
      ...data,
      status: CorrectionStatus.PENDING,
      approvalStage: stage,
      organizationId,
    });
    return this.correctionRepo.save(correction);
  }

  async getAttendanceCorrections(organizationId: string, actingEmployeeId: string, employeeId?: string, status?: string, actingRole?: string) {
    const query = this.correctionRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('c.organizationId = :organizationId', { organizationId });

    const scope = await this.resolveVisibilityScope(actingEmployeeId, organizationId, actingRole);
    if (!scope.seeAll) {
      query.andWhere('c.employeeId IN (:...visibleIds)', { visibleIds: scope.employeeIds.length ? scope.employeeIds : ['__none__'] });
    }

    if (employeeId) query.andWhere('c.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('c.status = :status', { status });
    query.orderBy('c.createdAt', 'DESC');
    return query.getMany();
  }

  async approveAttendanceCorrection(id: string, approved: boolean, remarks: string, organizationId: string, actingEmployeeId: string) {
    const correction = await this.correctionRepo.findOne({ where: { id, organizationId } });
    if (!correction) throw new NotFoundException('Correction request not found');
    if (correction.status !== CorrectionStatus.PENDING) throw new BadRequestException('This correction request has already been decided');

    const { deptHeadEmployeeId } = await this.resolveApprovalChain(correction.employeeId, organizationId);
    await this.assertAuthorizedApprover(actingEmployeeId, organizationId, correction.approvalStage, deptHeadEmployeeId);

    if (!approved) {
      correction.status = CorrectionStatus.REJECTED;
      correction.approvalRemarks = remarks;
      correction.approvedById = actingEmployeeId;
      correction.approvedAt = new Date();
      return this.correctionRepo.save(correction);
    }

    if (correction.approvalStage === ApprovalStage.PENDING_DEPT_HEAD) {
      correction.deptHeadApprovedById = actingEmployeeId;
      correction.deptHeadActionAt = new Date();
      correction.deptHeadRemarks = remarks;
      correction.approvalStage = ApprovalStage.PENDING_FINAL;
      return this.correctionRepo.save(correction);
    }

    correction.status = CorrectionStatus.APPROVED;
    correction.approvalRemarks = remarks;
    correction.approvedById = actingEmployeeId;
    correction.approvedAt = new Date();
    await this.correctionRepo.save(correction);

    // Apply the correction to the attendance record only once it's fully (finally) approved
    const record = await this.attendanceRepo.findOne({
      where: { organizationId, employeeId: correction.employeeId, attendanceDate: correction.attendanceDate },
    });
    if (record) {
      if (correction.requestedClockIn) record.clockInTime = correction.requestedClockIn;
      if (correction.requestedClockOut) record.clockOutTime = correction.requestedClockOut;
      if (record.clockInTime && record.clockOutTime) {
        const [inH, inM] = record.clockInTime.split(':').map(Number);
        const [outH, outM] = record.clockOutTime.split(':').map(Number);
        record.workHours = Math.max(0, Number(((outH * 60 + outM - (inH * 60 + inM)) / 60).toFixed(2)));
      }
      record.punchSource = PunchSource.WEB_MANUAL;
      await this.attendanceRepo.save(record);
    }
    return correction;
  }

  // ================= 19. OVERTIME MANAGEMENT =================
  async submitOvertimeRequest(data: Partial<OvertimeRequest>, organizationId: string): Promise<OvertimeRequest> {
    const { stage } = await this.resolveApprovalChain(data.employeeId, organizationId);
    const ot = this.overtimeRepo.create({
      ...data,
      status: OvertimeStatus.PENDING,
      approvalStage: stage,
      organizationId,
    });
    return this.overtimeRepo.save(ot);
  }

  async getOvertimeRequests(organizationId: string, actingEmployeeId: string, employeeId?: string, status?: string, actingRole?: string) {
    const query = this.overtimeRepo.createQueryBuilder('ot')
      .leftJoinAndSelect('ot.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('ot.organizationId = :organizationId', { organizationId });

    const scope = await this.resolveVisibilityScope(actingEmployeeId, organizationId, actingRole);
    if (!scope.seeAll) {
      query.andWhere('ot.employeeId IN (:...visibleIds)', { visibleIds: scope.employeeIds.length ? scope.employeeIds : ['__none__'] });
    }

    if (employeeId) query.andWhere('ot.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('ot.status = :status', { status });
    query.orderBy('ot.overtimeDate', 'DESC');
    return query.getMany();
  }

  async approveOvertimeRequest(id: string, approved: boolean, approvedHours: number, remarks: string, organizationId: string, actingEmployeeId: string) {
    const ot = await this.overtimeRepo.findOne({ where: { id, organizationId } });
    if (!ot) throw new NotFoundException('Overtime request not found');
    if (ot.status !== OvertimeStatus.PENDING) throw new BadRequestException('This overtime request has already been decided');

    const { deptHeadEmployeeId } = await this.resolveApprovalChain(ot.employeeId, organizationId);
    await this.assertAuthorizedApprover(actingEmployeeId, organizationId, ot.approvalStage, deptHeadEmployeeId);

    if (!approved) {
      ot.status = OvertimeStatus.REJECTED;
      ot.approvalRemarks = remarks;
      ot.approvedById = actingEmployeeId;
      ot.approvedAt = new Date();
      return this.overtimeRepo.save(ot);
    }

    if (ot.approvalStage === ApprovalStage.PENDING_DEPT_HEAD) {
      ot.deptHeadApprovedById = actingEmployeeId;
      ot.deptHeadActionAt = new Date();
      ot.deptHeadRemarks = remarks;
      ot.approvalStage = ApprovalStage.PENDING_FINAL;
      // Department Head's suggested hours (if any) carry forward as a starting point for final approval.
      if (approvedHours) ot.approvedHours = approvedHours;
      return this.overtimeRepo.save(ot);
    }

    ot.status = OvertimeStatus.APPROVED;
    ot.approvalRemarks = remarks;
    ot.approvedById = actingEmployeeId;
    ot.approvedAt = new Date();
    ot.approvedHours = approvedHours || ot.approvedHours || ot.requestedHours;
    ot.overtimeAmount = Number((ot.approvedHours * Number(ot.overtimeRate || 0)).toFixed(2));
    return this.overtimeRepo.save(ot);
  }

  // ================= 20. EMPLOYEE TRANSFERS =================
  async recordTransfer(data: Partial<EmployeeTransfer>, organizationId: string): Promise<EmployeeTransfer> {
    const transfer = this.transferRepo.create({
      ...data,
      status: TransferStatus.PENDING,
      organizationId,
    });
    const saved = await this.transferRepo.save(transfer);
    return saved;
  }

  async getTransfers(organizationId: string, employeeId?: string, status?: string) {
    const query = this.transferRepo.createQueryBuilder('tr')
      .leftJoinAndSelect('tr.employee', 'emp')
      .leftJoinAndSelect('tr.fromDepartment', 'fromDept')
      .leftJoinAndSelect('tr.toDepartment', 'toDept')
      .leftJoinAndSelect('tr.fromDesignation', 'fromDesig')
      .leftJoinAndSelect('tr.toDesignation', 'toDesig')
      .where('tr.organizationId = :organizationId', { organizationId });

    if (employeeId) query.andWhere('tr.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('tr.status = :status', { status });
    query.orderBy('tr.createdAt', 'DESC');
    return query.getMany();
  }

  async approveTransfer(id: string, approved: boolean, remarks: string, organizationId: string, userId?: string) {
    const transfer = await this.transferRepo.findOne({ where: { id, organizationId } });
    if (!transfer) throw new NotFoundException('Transfer record not found');

    transfer.status = approved ? TransferStatus.APPROVED : TransferStatus.REJECTED;
    transfer.approvalRemarks = remarks;
    transfer.approvedById = userId;
    const saved = await this.transferRepo.save(transfer);

    if (approved && transfer.employeeId) {
      // Apply transfer to employee record
      const updateData: any = {};
      if (transfer.toDepartmentId) updateData.departmentId = transfer.toDepartmentId;
      if (transfer.toDesignationId) updateData.designationId = transfer.toDesignationId;
      if (transfer.toBranch) updateData.branchName = transfer.toBranch;
      if (transfer.toReportingManagerId) updateData.reportingManagerId = transfer.toReportingManagerId;
      if (Object.keys(updateData).length > 0) {
        await this.employeeRepo.update({ id: transfer.employeeId, organizationId }, updateData);
      }

      // Add to timeline
      await this.recordTimelineEvent({
        employeeId: transfer.employeeId,
        eventType: TimelineEventType.TRANSFER,
        title: `Transfer Completed`,
        description: transfer.reason,
        eventDate: transfer.effectiveDate,
        metadata: { fromDeptId: transfer.fromDepartmentId, toDeptId: transfer.toDepartmentId, fromBranch: transfer.fromBranch, toBranch: transfer.toBranch },
        performedByUserId: userId,
      }, organizationId);
    }
    return saved;
  }

  // ================= 21. PERFORMANCE REVIEWS =================
  async createPerformanceReview(data: Partial<PerformanceReview>, organizationId: string): Promise<PerformanceReview> {
    const review = this.performanceRepo.create({ ...data, organizationId });
    const saved = await this.performanceRepo.save(review);

    await this.recordTimelineEvent({
      employeeId: data.employeeId,
      eventType: TimelineEventType.PERFORMANCE_REVIEW,
      title: `Performance Review: ${data.reviewCycle}`,
      description: `Rating: ${data.rating || 'N/A'} | Score: ${data.finalScore || 0}`,
      eventDate: data.reviewDate || new Date().toISOString().split('T')[0],
    }, organizationId);

    return saved;
  }

  async getPerformanceReviews(organizationId: string, employeeId?: string, cycle?: string) {
    const query = this.performanceRepo.createQueryBuilder('pr')
      .leftJoinAndSelect('pr.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .leftJoinAndSelect('emp.designation', 'desig')
      .where('pr.organizationId = :organizationId', { organizationId });

    if (employeeId) query.andWhere('pr.employeeId = :employeeId', { employeeId });
    if (cycle) query.andWhere('pr.reviewCycle = :cycle', { cycle });
    query.orderBy('pr.createdAt', 'DESC');
    return query.getMany();
  }

  async updatePerformanceReview(id: string, data: Partial<PerformanceReview>, organizationId: string): Promise<PerformanceReview> {
    const review = await this.performanceRepo.findOne({ where: { id, organizationId } });
    if (!review) throw new NotFoundException('Performance review not found');
    Object.assign(review, data);
    return this.performanceRepo.save(review);
  }

  // ================= 22. TRAINING MANAGEMENT =================
  async createTrainingProgram(data: Partial<TrainingProgram>, organizationId: string): Promise<TrainingProgram> {
    const training = this.trainingRepo.create({ ...data, organizationId });
    return this.trainingRepo.save(training);
  }

  async getTrainingPrograms(organizationId: string, status?: string) {
    const query = this.trainingRepo.createQueryBuilder('tp')
      .leftJoinAndSelect('tp.enrollments', 'enr')
      .leftJoinAndSelect('enr.employee', 'emp')
      .where('tp.organizationId = :organizationId', { organizationId });

    if (status) query.andWhere('tp.status = :status', { status });
    query.orderBy('tp.startDate', 'DESC');
    return query.getMany();
  }

  async updateTrainingProgram(id: string, data: Partial<TrainingProgram>, organizationId: string): Promise<TrainingProgram> {
    const tp = await this.trainingRepo.findOne({ where: { id, organizationId } });
    if (!tp) throw new NotFoundException('Training program not found');
    Object.assign(tp, data);
    return this.trainingRepo.save(tp);
  }

  async enrollInTraining(trainingProgramId: string, employeeIds: string[], organizationId: string) {
    const training = await this.trainingRepo.findOne({ where: { id: trainingProgramId, organizationId } });
    if (!training) throw new NotFoundException('Training program not found');

    const results = [];
    for (const empId of employeeIds) {
      const existing = await this.enrollmentRepo.findOne({ where: { trainingProgramId, employeeId: empId, organizationId } });
      if (existing) continue;

      const enrollment = this.enrollmentRepo.create({
        trainingProgramId,
        employeeId: empId,
        status: EnrollmentStatus.ENROLLED,
        organizationId,
      });
      results.push(await this.enrollmentRepo.save(enrollment));
    }
    return results;
  }

  async updateEnrollment(id: string, data: Partial<TrainingEnrollment>, organizationId: string): Promise<TrainingEnrollment> {
    const enr = await this.enrollmentRepo.findOne({ where: { id, organizationId } });
    if (!enr) throw new NotFoundException('Enrollment not found');
    Object.assign(enr, data);
    return this.enrollmentRepo.save(enr);
  }

  async getEnrollmentsByEmployee(employeeId: string, organizationId: string) {
    return this.enrollmentRepo.find({
      where: { employeeId, organizationId },
      relations: ['trainingProgram'],
      order: { createdAt: 'DESC' },
    });
  }

  // ================= 23. DISCIPLINARY ACTIONS =================
  async createDisciplinaryAction(data: Partial<DisciplinaryAction>, organizationId: string): Promise<DisciplinaryAction> {
    const action = this.disciplinaryRepo.create({ ...data, organizationId });
    const saved = await this.disciplinaryRepo.save(action);

    await this.recordTimelineEvent({
      employeeId: data.employeeId,
      eventType: TimelineEventType.DISCIPLINARY,
      title: `${data.actionType}: ${data.subject}`,
      description: data.description,
      eventDate: data.actionDate || new Date().toISOString().split('T')[0],
      performedByName: data.issuedByName,
      performedByUserId: data.issuedByUserId,
    }, organizationId);

    return saved;
  }

  async getDisciplinaryActions(organizationId: string, employeeId?: string, status?: string) {
    const query = this.disciplinaryRepo.createQueryBuilder('da')
      .leftJoinAndSelect('da.employee', 'emp')
      .leftJoinAndSelect('emp.department', 'dept')
      .where('da.organizationId = :organizationId', { organizationId });

    if (employeeId) query.andWhere('da.employeeId = :employeeId', { employeeId });
    if (status) query.andWhere('da.status = :status', { status });
    query.orderBy('da.createdAt', 'DESC');
    return query.getMany();
  }

  async updateDisciplinaryAction(id: string, data: Partial<DisciplinaryAction>, organizationId: string): Promise<DisciplinaryAction> {
    const action = await this.disciplinaryRepo.findOne({ where: { id, organizationId } });
    if (!action) throw new NotFoundException('Disciplinary action not found');
    Object.assign(action, data);
    return this.disciplinaryRepo.save(action);
  }

  // ================= 24. HR ANNOUNCEMENTS =================
  async createAnnouncement(data: Partial<HrAnnouncement>, organizationId: string): Promise<HrAnnouncement> {
    const announcement = this.announcementRepo.create({ ...data, organizationId });
    return this.announcementRepo.save(announcement);
  }

  async getAnnouncements(organizationId: string, activeOnly = false) {
    const query = this.announcementRepo.createQueryBuilder('ann')
      .where('ann.organizationId = :organizationId', { organizationId });

    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      query.andWhere('ann.isActive = true')
        .andWhere('(ann.expiryDate IS NULL OR ann.expiryDate >= :today)', { today });
    }
    query.orderBy('ann.createdAt', 'DESC');
    return query.getMany();
  }

  async updateAnnouncement(id: string, data: Partial<HrAnnouncement>, organizationId: string): Promise<HrAnnouncement> {
    const ann = await this.announcementRepo.findOne({ where: { id, organizationId } });
    if (!ann) throw new NotFoundException('Announcement not found');
    Object.assign(ann, data);
    return this.announcementRepo.save(ann);
  }

  async deleteAnnouncement(id: string, organizationId: string) {
    const ann = await this.announcementRepo.findOne({ where: { id, organizationId } });
    if (!ann) throw new NotFoundException('Announcement not found');
    await this.announcementRepo.remove(ann);
    return { success: true };
  }

  // ================= 25. LOAN REPAYMENTS =================
  async recordLoanRepayment(data: Partial<LoanRepayment>, organizationId: string): Promise<LoanRepayment> {
    const loan = await this.loanRepo.findOne({ where: { id: data.loanId, organizationId } });
    if (!loan) throw new NotFoundException('Loan not found');

    loan.totalPaidAmount = Number(loan.totalPaidAmount || 0) + Number(data.amount || 0);
    const outstanding = Math.max(0, Number(loan.principalAmount) - loan.totalPaidAmount);

    if (outstanding <= 0) {
      loan.status = LoanStatus.PAID;
    }
    await this.loanRepo.save(loan);

    const repayment = this.loanRepaymentRepo.create({
      ...data,
      outstandingAfterPayment: outstanding,
      organizationId,
    });
    return this.loanRepaymentRepo.save(repayment);
  }

  async getLoanRepayments(loanId: string, organizationId: string): Promise<LoanRepayment[]> {
    return this.loanRepaymentRepo.find({
      where: { loanId, organizationId },
      order: { paymentDate: 'DESC' },
    });
  }

  // ================= 26. FINAL SETTLEMENT =================
  async computeFinalSettlement(employeeId: string, organizationId: string) {
    const emp = await this.employeeRepo.findOne({
      where: { id: employeeId, organizationId },
      relations: ['department', 'designation'],
    });
    if (!emp) throw new NotFoundException('Employee not found');

    const clearance = await this.clearanceRepo.findOne({
      where: { employeeId, organizationId },
      order: { createdAt: 'DESC' },
    });

    const salaryStruct = await this.salaryStructureRepo.findOne({ where: { employeeId, organizationId } });
    const basic = Number(salaryStruct?.basicSalary || emp.basicSalary || 0);

    // Loan outstanding
    const activeLoans = await this.loanRepo.find({
      where: { organizationId, employeeId, status: LoanStatus.APPROVED },
    });
    const totalLoanOutstanding = activeLoans.reduce((sum, l) => {
      return sum + Math.max(0, Number(l.principalAmount) - Number(l.totalPaidAmount));
    }, 0);

    // Leave encashment (unused annual leave * daily salary rate)
    const leaveBalances = await this.getLeaveBalances(employeeId, organizationId);
    const annualLeave = leaveBalances.find(lb => lb.leaveTypeName.toLowerCase().includes('annual') || lb.leaveTypeName.toLowerCase().includes('earned'));
    const encashmentDays = annualLeave ? annualLeave.remainingDays : 0;
    const dailySalary = Number((basic / 26).toFixed(2)); // 26 working days per month
    const leaveEncashment = Number((encashmentDays * dailySalary).toFixed(2));

    // Pending expense claims
    const pendingExpenses = await this.expenseClaimRepo.find({
      where: { employeeId, organizationId, status: ExpenseClaimStatus.APPROVED },
    });
    const expenseReimbursements = pendingExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Unpaid approved overtime
    const unpaidOvertimes = await this.overtimeRepo.find({
      where: { employeeId, organizationId, status: OvertimeStatus.APPROVED, includedInPayroll: false },
    });
    const overtimePay = unpaidOvertimes.reduce((sum, ot) => sum + Number(ot.overtimeAmount || 0), 0);

    const totalEarnings = leaveEncashment + expenseReimbursements + overtimePay;
    const totalDeductions = totalLoanOutstanding;
    const finalAmount = Number((totalEarnings - totalDeductions).toFixed(2));

    return {
      employee: emp,
      clearance,
      salaryStructure: salaryStruct,
      basicSalary: basic,
      dailySalary,
      leaveEncashment: { days: encashmentDays, amount: leaveEncashment },
      expenseReimbursements,
      overtimePay,
      totalLoanOutstanding,
      totalEarnings,
      totalDeductions,
      finalSettlementAmount: finalAmount,
      activeLoans,
    };
  }

  // ================= 27. SHIFT UPDATE/DELETE =================
  async updateWorkShift(id: string, data: Partial<WorkShift>, organizationId: string): Promise<WorkShift> {
    const shift = await this.workShiftRepo.findOne({ where: { id, organizationId } });
    if (!shift) throw new NotFoundException('Work shift not found');
    if (data.isDefault) {
      await this.workShiftRepo.update({ organizationId }, { isDefault: false });
    }
    Object.assign(shift, data);
    return this.workShiftRepo.save(shift);
  }

  async deleteWorkShift(id: string, organizationId: string): Promise<{ success: boolean }> {
    const shift = await this.workShiftRepo.findOne({ where: { id, organizationId } });
    if (!shift) throw new NotFoundException('Work shift not found');
    await this.workShiftRepo.remove(shift);
    return { success: true };
  }

  async updateHoliday(id: string, data: Partial<Holiday>, organizationId: string): Promise<Holiday> {
    const holiday = await this.holidayRepo.findOne({ where: { id, organizationId } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    Object.assign(holiday, data);
    return this.holidayRepo.save(holiday);
  }

  // ================= 28. HR REPORTS =================
  async getHrReport(organizationId: string, reportType: string, params: any = {}) {
    switch (reportType) {
      case 'employee-summary': {
        const query = this.employeeRepo.createQueryBuilder('emp')
          .leftJoinAndSelect('emp.department', 'dept')
          .leftJoinAndSelect('emp.designation', 'desig')
          .leftJoinAndSelect('emp.reportingManager', 'mgr')
          .where('emp.organizationId = :organizationId', { organizationId });
        if (params.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
        if (params.status) query.andWhere('emp.status = :status', { status: params.status });
        query.orderBy('emp.employeeCode', 'ASC');
        const rows = await query.getMany();

        const summary = {
          totalEmployees: rows.length,
          activeCount: rows.filter((e) => e.status === EmploymentStatus.ACTIVE).length,
          probationCount: rows.filter((e) => e.status === EmploymentStatus.PROBATION).length,
          resignedCount: rows.filter((e) => e.status === EmploymentStatus.RESIGNED || e.status === EmploymentStatus.TERMINATED).length,
        };
        return { summary, rows };
      }

      case 'attendance': {
        const query = this.attendanceRepo.createQueryBuilder('att')
          .leftJoinAndSelect('att.employee', 'emp')
          .leftJoinAndSelect('emp.department', 'dept')
          .where('att.organizationId = :organizationId', { organizationId });
        if (params.from) query.andWhere('att.attendanceDate >= :from', { from: params.from });
        if (params.to) query.andWhere('att.attendanceDate <= :to', { to: params.to });
        if (params.employeeId) query.andWhere('att.employeeId = :employeeId', { employeeId: params.employeeId });
        if (params.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
        query.orderBy('att.attendanceDate', 'DESC');
        const rows = await query.getMany();

        const totalWorkHours = rows.reduce((sum, r) => sum + Number(r.workHours || 0), 0);
        const summary = {
          totalRecords: rows.length,
          presentCount: rows.filter((r) => r.status === AttendanceStatus.PRESENT).length,
          lateCount: rows.filter((r) => r.status === AttendanceStatus.LATE).length,
          onLeaveCount: rows.filter((r) => r.status === AttendanceStatus.ON_LEAVE).length,
          avgWorkHours: rows.length ? Number((totalWorkHours / rows.length).toFixed(2)) : 0,
        };
        return { summary, rows };
      }

      case 'employee-attendance': {
        const query = this.attendanceRepo.createQueryBuilder('att')
          .leftJoinAndSelect('att.employee', 'emp')
          .leftJoinAndSelect('emp.department', 'dept')
          .where('att.organizationId = :organizationId', { organizationId });
        if (params.from) query.andWhere('att.attendanceDate >= :from', { from: params.from });
        if (params.to) query.andWhere('att.attendanceDate <= :to', { to: params.to });
        if (params.employeeId) query.andWhere('att.employeeId = :employeeId', { employeeId: params.employeeId });
        if (params.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
        const records = await query.getMany();
        const grouped = new Map<string, any>();
        records.forEach((record) => {
          const key = record.employeeId;
          const row = grouped.get(key) || { id: key, employee: record.employee, totalDays: 0, presentDays: 0, lateDays: 0, leaveDays: 0, absentDays: 0, totalWorkHours: 0 };
          row.totalDays += 1;
          row.totalWorkHours += Number(record.workHours || 0);
          if (record.status === AttendanceStatus.PRESENT) row.presentDays += 1;
          else if (record.status === AttendanceStatus.LATE) row.lateDays += 1;
          else if (record.status === AttendanceStatus.ON_LEAVE) row.leaveDays += 1;
          else row.absentDays += 1;
          grouped.set(key, row);
        });
        const rows = Array.from(grouped.values()).map((row) => ({ ...row, totalWorkHours: Number(row.totalWorkHours.toFixed(2)), attendanceRate: row.totalDays ? Number((((row.presentDays + row.lateDays) / row.totalDays) * 100).toFixed(1)) : 0 })).sort((a, b) => a.employee?.employeeCode?.localeCompare(b.employee?.employeeCode || '') || 0);
        return { summary: { totalEmployees: rows.length, presentDays: rows.reduce((sum, row) => sum + row.presentDays, 0), lateDays: rows.reduce((sum, row) => sum + row.lateDays, 0), totalWorkHours: Number(rows.reduce((sum, row) => sum + row.totalWorkHours, 0).toFixed(2)) }, rows };
      }

      case 'department-attendance': {
        const query = this.attendanceRepo.createQueryBuilder('att')
          .leftJoinAndSelect('att.employee', 'emp')
          .leftJoinAndSelect('emp.department', 'dept')
          .where('att.organizationId = :organizationId', { organizationId });
        if (params.from) query.andWhere('att.attendanceDate >= :from', { from: params.from });
        if (params.to) query.andWhere('att.attendanceDate <= :to', { to: params.to });
        if (params.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
        const records = await query.getMany();
        const grouped = new Map<string, any>();
        records.forEach((record) => {
          const key = record.employee?.departmentId || 'unassigned';
          const row = grouped.get(key) || { id: key, department: record.employee?.department, totalRecords: 0, employees: new Set<string>(), presentCount: 0, lateCount: 0, leaveCount: 0, absentCount: 0, totalWorkHours: 0 };
          row.totalRecords += 1; row.employees.add(record.employeeId); row.totalWorkHours += Number(record.workHours || 0);
          if (record.status === AttendanceStatus.PRESENT) row.presentCount += 1;
          else if (record.status === AttendanceStatus.LATE) row.lateCount += 1;
          else if (record.status === AttendanceStatus.ON_LEAVE) row.leaveCount += 1;
          else row.absentCount += 1;
          grouped.set(key, row);
        });
        const rows = Array.from(grouped.values()).map((row) => ({ ...row, employeeCount: row.employees.size, employees: undefined, totalWorkHours: Number(row.totalWorkHours.toFixed(2)), attendanceRate: row.totalRecords ? Number((((row.presentCount + row.lateCount) / row.totalRecords) * 100).toFixed(1)) : 0 }));
        return { summary: { totalDepartments: rows.length, totalEmployees: rows.reduce((sum, row) => sum + row.employeeCount, 0), presentCount: rows.reduce((sum, row) => sum + row.presentCount, 0), totalWorkHours: Number(rows.reduce((sum, row) => sum + row.totalWorkHours, 0).toFixed(2)) }, rows };
      }

      case 'leave': {
        const query = this.leaveRequestRepo.createQueryBuilder('lr')
          .leftJoinAndSelect('lr.employee', 'emp')
          .leftJoinAndSelect('emp.department', 'dept')
          .leftJoinAndSelect('lr.leaveType', 'lt')
          .where('lr.organizationId = :organizationId', { organizationId });
        if (params.from) query.andWhere('lr.startDate >= :from', { from: params.from });
        if (params.to) query.andWhere('lr.endDate <= :to', { to: params.to });
        if (params.status) query.andWhere('lr.status = :status', { status: params.status });
        if (params.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
        query.orderBy('lr.createdAt', 'DESC');
        const rows = await query.getMany();

        const summary = {
          totalRequests: rows.length,
          approvedCount: rows.filter((r) => r.status === LeaveStatus.APPROVED).length,
          pendingCount: rows.filter((r) => r.status === LeaveStatus.PENDING).length,
          rejectedCount: rows.filter((r) => r.status === LeaveStatus.REJECTED).length,
          totalDaysApproved: rows.filter((r) => r.status === LeaveStatus.APPROVED).reduce((sum, r) => sum + (r.daysCount || 0), 0),
        };
        return { summary, rows };
      }

      case 'payroll': {
        // PayrollSheet is a monthly run, not a single date — a day-range picker doesn't
        // map cleanly onto it, so only department filters here; date range is used by
        // the other (day-level) report types.
        const query = this.payrollItemRepo.createQueryBuilder('item')
          .leftJoinAndSelect('item.employee', 'emp')
          .leftJoinAndSelect('emp.department', 'dept')
          .leftJoinAndSelect('item.payrollSheet', 'sheet')
          .where('item.organizationId = :organizationId', { organizationId });
        if (params.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
        if (params.employeeId) query.andWhere('item.employeeId = :employeeId', { employeeId: params.employeeId });
        if (params.year) query.andWhere('sheet.year = :year', { year: Number(params.year) });
        if (params.month) query.andWhere('sheet.month = :month', { month: Number(params.month) });
        query.orderBy('sheet.year', 'DESC').addOrderBy('sheet.month', 'DESC').addOrderBy('emp.employeeCode', 'ASC');
        query.take(500);
        const rows = await query.getMany();

        const summary = {
          employeeCount: new Set(rows.map((r) => r.employeeId)).size,
          totalGross: Number(rows.reduce((sum, r) => sum + Number(r.basicSalary || 0) + Number(r.totalAllowances || 0) + Number(r.commissionsEarned || 0) + Number(r.bonus || 0), 0).toFixed(2)),
          totalDeductions: Number(rows.reduce((sum, r) => sum + Number(r.unpaidLeaveDeductions || 0) + Number(r.taxDeductions || 0), 0).toFixed(2)),
          totalNetSalary: Number(rows.reduce((sum, r) => sum + Number(r.netSalary || 0), 0).toFixed(2)),
        };
        return { summary, rows };
      }

      case 'salary':
        return this.getHrReport(organizationId, 'payroll', params);

      case 'overtime': {
        const query = this.overtimeRepo.createQueryBuilder('ot')
          .leftJoinAndSelect('ot.employee', 'emp')
          .leftJoinAndSelect('emp.department', 'dept')
          .where('ot.organizationId = :organizationId', { organizationId });
        if (params.from) query.andWhere('ot.overtimeDate >= :from', { from: params.from });
        if (params.to) query.andWhere('ot.overtimeDate <= :to', { to: params.to });
        if (params.status) query.andWhere('ot.status = :status', { status: params.status });
        if (params.departmentId) query.andWhere('emp.departmentId = :deptId', { deptId: params.departmentId });
        query.orderBy('ot.overtimeDate', 'DESC');
        const rows = await query.getMany();

        const summary = {
          totalRequests: rows.length,
          approvedCount: rows.filter((r) => r.status === OvertimeStatus.APPROVED).length,
          pendingCount: rows.filter((r) => r.status === OvertimeStatus.PENDING).length,
          totalApprovedHours: Number(rows.filter((r) => r.status === OvertimeStatus.APPROVED).reduce((sum, r) => sum + Number(r.approvedHours || 0), 0).toFixed(2)),
          totalOvertimeAmount: Number(rows.filter((r) => r.status === OvertimeStatus.APPROVED).reduce((sum, r) => sum + Number(r.overtimeAmount || 0), 0).toFixed(2)),
        };
        return { summary, rows };
      }

      case 'recruitment': {
        const rows = await this.jobApplicationRepo.find({
          where: { organizationId },
          relations: ['jobOpening', 'convertedEmployee'],
          order: { createdAt: 'DESC' },
        });
        const summary = {
          totalApplications: rows.length,
          hiredCount: rows.filter((r) => r.stage === ApplicationStage.HIRED).length,
          inProgressCount: rows.filter((r) => r.stage !== ApplicationStage.HIRED && r.stage !== ApplicationStage.REJECTED).length,
        };
        return { summary, rows };
      }

      case 'training': {
        const rows = await this.enrollmentRepo.find({
          where: { organizationId },
          relations: ['trainingProgram', 'employee', 'employee.department'],
          order: { createdAt: 'DESC' },
        });
        const summary = {
          totalEnrollments: rows.length,
          completedCount: rows.filter((r) => r.status === EnrollmentStatus.COMPLETED).length,
        };
        return { summary, rows };
      }

      default:
        throw new BadRequestException(`Unknown report type: '${reportType}'. Valid types: employee-summary, attendance, employee-attendance, department-attendance, leave, payroll, salary, overtime, recruitment, training`);
    }
  }

  // ================= 29. LEAVE CALENDAR =================
  async getLeaveCalendar(organizationId: string, month: number, year: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const [leaves, holidays] = await Promise.all([
      this.leaveRequestRepo.createQueryBuilder('lr')
        .leftJoinAndSelect('lr.employee', 'emp')
        .leftJoinAndSelect('lr.leaveType', 'lt')
        .where('lr.organizationId = :organizationId', { organizationId })
        .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
        .andWhere('lr.startDate <= :endDate', { endDate })
        .andWhere('lr.endDate >= :startDate', { startDate })
        .getMany(),
      this.holidayRepo.find({ where: { organizationId } }),
    ]);

    return { leaves, holidays, month, year };
  }

  // ================= 30. PAYROLL SHEET ITEMS =================
  async getPayrollSheetItems(sheetId: string, organizationId: string) {
    const sheet = await this.payrollSheetRepo.findOne({
      where: { id: sheetId, organizationId },
    });
    if (!sheet) throw new NotFoundException('Payroll sheet not found');

    const items = await this.payrollItemRepo.find({
      where: { payrollSheetId: sheetId, organizationId },
      relations: ['employee', 'employee.department', 'employee.designation'],
    });
    return { sheet, items };
  }
}
