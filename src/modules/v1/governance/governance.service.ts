import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { AuditLog } from './entities/audit-log.entity';
import { UserLoginLog } from './entities/user-login-log.entity';
import { ApprovalRule, ApprovalModuleType } from './entities/approval-rule.entity';

@Injectable()
export class GovernanceService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(UserLoginLog)
    private readonly loginLogRepo: Repository<UserLoginLog>,
    @InjectRepository(ApprovalRule)
    private readonly approvalRuleRepo: Repository<ApprovalRule>,
  ) {}

  // ================= BRANCHES =================
  async createBranch(data: Partial<Branch>, organizationId: string): Promise<Branch> {
    const existing = await this.branchRepo.findOne({
      where: { organizationId, branchCode: data.branchCode?.trim() },
    });
    if (existing) throw new BadRequestException(`Branch code '${data.branchCode}' already exists`);

    const branch = this.branchRepo.create({ ...data, organizationId });
    return this.branchRepo.save(branch);
  }

  async getBranches(organizationId: string): Promise<Branch[]> {
    return this.branchRepo.find({
      where: { organizationId },
      order: { branchCode: 'ASC' },
      relations: ['defaultWarehouse'],
    });
  }

  // ================= AUDIT LOGS =================
  async logAction(data: Partial<AuditLog>, organizationId: string): Promise<AuditLog> {
    const log = this.auditLogRepo.create({ ...data, organizationId });
    return this.auditLogRepo.save(log);
  }

  async getAuditLogs(
    options: { entityName?: string; entityId?: string; startDate?: string; endDate?: string },
    organizationId: string,
  ) {
    const qb = this.auditLogRepo
      .createQueryBuilder('log')
      .where('log.organizationId = :organizationId', { organizationId })
      .orderBy('log.createdAt', 'DESC')
      .take(100);

    if (options.entityName) qb.andWhere('log.entityName = :entity', { entity: options.entityName });
    if (options.entityId) qb.andWhere('log.entityId = :id', { id: options.entityId });

    return qb.getMany();
  }

  // ================= USER LOGIN LOGS =================
  async logLogin(data: Partial<UserLoginLog>, organizationId: string): Promise<UserLoginLog> {
    const log = this.loginLogRepo.create({ ...data, organizationId });
    return this.loginLogRepo.save(log);
  }

  async getLoginLogs(organizationId: string): Promise<UserLoginLog[]> {
    return this.loginLogRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // ================= APPROVAL RULES =================
  async setApprovalRule(data: Partial<ApprovalRule>, organizationId: string): Promise<ApprovalRule> {
    const rule = this.approvalRuleRepo.create({ ...data, organizationId });
    return this.approvalRuleRepo.save(rule);
  }

  async getApprovalRules(organizationId: string): Promise<ApprovalRule[]> {
    return this.approvalRuleRepo.find({ where: { organizationId } });
  }
}
