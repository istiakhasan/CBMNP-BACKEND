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
    ]),
  ],
  controllers: [HrPayrollController],
  providers: [HrPayrollService],
  exports: [HrPayrollService],
})
export class HrPayrollModule {}
