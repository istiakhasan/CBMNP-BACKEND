import { Controller, Post, Body, Headers, Req, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { HrPayrollService } from './hr-payroll.service';
import { Request } from 'express';

// Deliberately separate from HrPayrollController and carries NO AuthGuard — the caller
// here is a physical biometric device (or its local polling bridge), never a logged-in
// user, so there is no JWT to check. Authenticity is instead verified inside the service
// via the device's own per-device apiKey (see HrPayrollService.processBiometricSync).
@ApiTags('HR & Payroll Enterprise')
@Controller('v1/hr-payroll/biometric')
export class BiometricWebhookController {
  constructor(private readonly hrPayrollService: HrPayrollService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Biometric device push webhook — authenticated via device API key, not user login' })
  @ApiHeader({ name: 'x-device-api-key', required: false, description: 'Biometric device API key' })
  async syncBiometricPunches(
    @Body() body: any,
    @Headers('x-device-api-key') headerApiKey: string,
    @Req() req: Request,
  ) {
    const orgId = req.headers['x-organization-id'] as string;
    const apiKey = headerApiKey || body?.apiKey;
    const result = await this.hrPayrollService.processBiometricSync(apiKey, body, orgId);
    return { success: true, statusCode: 200, ...result };
  }

  @Post('devices/:deviceId/enrolled-users/sync')
  @ApiOperation({ summary: 'Save the enrolled-device roster sent by an office-LAN sync agent' })
  @ApiHeader({ name: 'x-device-api-key', required: false, description: 'Biometric device API key' })
  async syncEnrolledUsers(
    @Param('deviceId') deviceId: string,
    @Body() body: any,
    @Headers('x-device-api-key') headerApiKey: string,
  ) {
    const result = await this.hrPayrollService.receiveEnrolledDeviceUsers(
      deviceId,
      headerApiKey || body?.apiKey,
      Array.isArray(body?.users) ? body.users : [],
    );
    return {
      success: true,
      statusCode: 200,
      message: `${result.users.length} enrolled user(s) saved`,
      data: result,
    };
  }
}
