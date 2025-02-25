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
@Controller('/v1/auth')
export class AuthenTicationController {
  constructor(private readonly authenTicationService: AuthenTicationService) {}
  @Post('/log-in')
  async login(@Body(new ZodPipe(loginSchema)) data, @Res() res: Response) {
    const result = await this.authenTicationService.login(data);
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: 'User signed in successfully',
      data: result,
    });
  }

  @Post('/refresh-token')
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
  )
  async getProfile(@Res() res: Response, @Req() req: Request) {
    const result = await this.authenTicationService.getProfile(req.user);
    res.status(HttpStatus.OK).json({
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Profile retrived successfully...',
      data: result,
    });
  }

  @Post('employee-change-password')
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
