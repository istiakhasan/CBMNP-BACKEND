import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { AuditLog } from './entities/audit-log.entity';
import { UserLoginLog } from './entities/user-login-log.entity';
import { ApprovalRule } from './entities/approval-rule.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Branch,
      AuditLog,
      UserLoginLog,
      ApprovalRule,
      Warehouse,
    ]),
  ],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
