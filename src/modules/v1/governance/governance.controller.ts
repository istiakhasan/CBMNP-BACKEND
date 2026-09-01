import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { Request } from 'express';

@ApiTags('Governance, Branches & Audit')
@Controller('v1/governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  // Branches
  @Post('branches')
  @ApiOperation({ summary: 'Create business branch / outlet' })
  async createBranch(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.governanceService.createBranch(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('branches')
  @ApiOperation({ summary: 'Get all branches' })
  async getBranches(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.governanceService.getBranches(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Audit Logs
  @Get('audit-logs')
  @ApiOperation({ summary: 'Get system audit trail' })
  async getAuditLogs(
    @Query('entityName') entityName: string,
    @Query('entityId') entityId: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.governanceService.getAuditLogs({ entityName, entityId }, orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Login History
  @Get('login-history')
  @ApiOperation({ summary: 'Get user login and security logs' })
  async getLoginLogs(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.governanceService.getLoginLogs(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }

  // Approval Rules
  @Post('approval-rules')
  @ApiOperation({ summary: 'Set threshold approval rule' })
  async setApprovalRule(@Body() data: any, @Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.governanceService.setApprovalRule(data, orgId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('approval-rules')
  @ApiOperation({ summary: 'Get all approval rules' })
  async getApprovalRules(@Req() req: Request) {
    const orgId = req.headers['x-organization-id'] as string;
    const result = await this.governanceService.getApprovalRules(orgId);
    return { success: true, statusCode: HttpStatus.OK, data: result };
  }
}
