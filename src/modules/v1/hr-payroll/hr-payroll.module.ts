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
import { HrPayrollService } from './hr-payroll.service';
import { HrPayrollController } from './hr-payroll.controller';

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
    ]),
  ],
  controllers: [HrPayrollController],
  providers: [HrPayrollService],
  exports: [HrPayrollService],
})
export class HrPayrollModule {}
