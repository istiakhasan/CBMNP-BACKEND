import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { Designation } from './entities/designation.entity';
import { Employee } from './entities/employee.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { SalaryStructure } from './entities/salary-structure.entity';
import { PayrollSheet } from './entities/payroll-sheet.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { CommissionRule } from './entities/commission-rule.entity';
import { CommissionRecord } from './entities/commission-record.entity';
import { SalesTarget } from './entities/sales-target.entity';
import { BiometricDevice } from './entities/biometric-device.entity';
import { BiometricPunchLog } from './entities/biometric-punch-log.entity';
import { WorkShift } from './entities/work-shift.entity';
import { JobOpening } from './entities/job-opening.entity';
import { JobApplication } from './entities/job-application.entity';
import { EmployeeLoan } from './entities/employee-loan.entity';
import { ExpenseClaim } from './entities/expense-claim.entity';
import { Holiday } from './entities/holiday.entity';
import { EmployeeAsset } from './entities/employee-asset.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { PromotionHistory } from './entities/promotion-history.entity';
import { ResignationClearance } from './entities/resignation-clearance.entity';
// New entities
import { EmployeeTimeline } from './entities/employee-timeline.entity';
import { SalaryHistory } from './entities/salary-history.entity';
import { AttendanceCorrection } from './entities/attendance-correction.entity';
import { OvertimeRequest } from './entities/overtime-request.entity';
import { EmployeeTransfer } from './entities/employee-transfer.entity';
import { PerformanceReview } from './entities/performance-review.entity';
import { TrainingProgram } from './entities/training-program.entity';
import { TrainingEnrollment } from './entities/training-enrollment.entity';
import { DisciplinaryAction } from './entities/disciplinary-action.entity';
import { HrAnnouncement } from './entities/hr-announcement.entity';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { HrOffice } from './entities/office.entity';
import { Users } from '../user/entities/user.entity';
import { HrPayrollService } from './hr-payroll.service';
import { HrPayrollController } from './hr-payroll.controller';
import { BiometricWebhookController } from './biometric-webhook.controller';
import { BiometricDevicePollerService } from './biometric-device-poller.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      Designation,
      Employee,
      AttendanceRecord,
      LeaveType,
      LeaveRequest,
      SalaryStructure,
      PayrollSheet,
      PayrollItem,
      CommissionRule,
      CommissionRecord,
      SalesTarget,
      BiometricDevice,
      BiometricPunchLog,
      WorkShift,
      JobOpening,
      JobApplication,
      EmployeeLoan,
      ExpenseClaim,
      Holiday,
      EmployeeAsset,
      EmployeeDocument,
      PromotionHistory,
      ResignationClearance,
      // New entities
      EmployeeTimeline,
      SalaryHistory,
      AttendanceCorrection,
      OvertimeRequest,
      EmployeeTransfer,
      PerformanceReview,
      TrainingProgram,
      TrainingEnrollment,
      DisciplinaryAction,
      HrAnnouncement,
      LoanRepayment,
      HrOffice,
      Users,
    ]),
  ],
  controllers: [HrPayrollController, BiometricWebhookController],
  providers: [HrPayrollService, BiometricDevicePollerService],
  exports: [HrPayrollService, BiometricDevicePollerService],
})
export class HrPayrollModule {}
