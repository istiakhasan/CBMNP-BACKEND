import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthenTicationService } from './auth.service';
import { loginSchema } from './auth.validation';
import { ZodPipe } from '../../../middleware/ZodPipe';
import { Request, Response } from 'express';


import { ChangePasswordDto } from './dto/change-password.dto';
import { Roles } from '../../../middleware/roles.decorator';
import { AuthGuard } from '../../../middleware/auth.guard';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
@ApiTags('Authentication')
@Controller('/v1/auth')
export class AuthenTicationController {
  constructor(private readonly authenTicationService: AuthenTicationService) {}
  @Post('/log-in')
  @ApiOperation({ summary: 'Sign in and receive access and refresh tokens' })
  @ApiBody({ schema: { example: { email: 'admin@example.com', password: 'StrongPassword123!' } } })
  @ApiResponse({ status: 200, description: 'Use data.accessToken as the raw Authorization header value.' })
  async login(@Body(new ZodPipe(loginSchema)) data, @Res() res: Response) {
    const result = await this.authenTicationService.login(data);
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: 'User signed in successfully',
      data: result,
    });
  }
  @Post('/super/log-in')
  @ApiOperation({ summary: 'Sign in as a super administrator' })
  @ApiBody({ schema: { example: { email: 'superadmin@example.com', password: 'StrongPassword123!' } } })
  async adminLogin(@Body(new ZodPipe(loginSchema)) data, @Res() res: Response) {
    const result = await this.authenTicationService.adminLogin(data);
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Super Admin signed in successfully',
      data: result,
    });
  }

  @Post('/refresh-token')
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  @ApiBody({ schema: { example: { refreshToken: '<refresh-token-from-login>' } } })
  async refreshToken(@Res() res: Response, @Req() req: Request) {
    const result = await this.authenTicationService.refreshToken(
      req.body.refreshToken,
    );
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Refresh token genarate successfully',
      data: { token: result.accessToken },
    });
  }

  @Get('/profile')
  @ApiOperation({ summary: 'Get the signed-in user profile' })
  @UseGuards(AuthGuard)
  @Roles(
    'admin',
    'hr',
    'agent',
    'user',
    'ctgadmin',
    'cos',
    'warehouse_manager',
    'operation_manager',
    'cs_agent',
    'media_manager',
    'cs_website_agent',
    'owner',
    'super_admin',
    'master_admin',
  )
  async getProfile(@Res() res: Response, @Req() req: any) {
    const result = await this.authenTicationService.getProfile(req.user);
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Profile retrived successfully...',
      data: result,
    });
  }

  @Post('employee-change-password')
  @ApiOperation({ summary: 'Change the signed-in employee password' })
  @ApiBody({ schema: { example: { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' } } })
  @UseGuards(AuthGuard)
  async changePassword(
    @Req() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // console.log(req.user);
    const userId = req.user.employeeId;
    await this.authenTicationService.changePassword(userId, changePasswordDto);
    return { message: 'Password changed successfully' };
  }
}
