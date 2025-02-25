import { InjectRepository } from '@nestjs/typeorm';
import { UserAuth } from './entities/auth.entity';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiError } from '../../../middleware/ApiError';
import config from '../../../config';
import * as bcryptjs from 'bcrypt';

import { ChangePasswordDto } from './dto/change-password.dto';
import { Users } from '../user/entities/user.entity';
import { jwtHelpers } from '../../../helpers/jwtHelpers';
@Injectable()
export class AuthenTicationService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {}
  async login(
    data: any,
  ): Promise<{ refreshToken: string; accessToken: string }> {
    const isUserExist = await this.usersRepository.findOne({
      where: { userId: data?.userId },
      relations:['organization']
    });
    if (!isUserExist) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'User not exist');
    }
    const { userId, password: savePassword, role, id,organization:{id:organizationId} } = isUserExist;
    console.log(organizationId,"check");
    const isPasswordMatch =await bcryptjs.compare(data.password, savePassword);
    if (!isPasswordMatch) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Password is incorrect');
    }

    const accessToken = jwtHelpers.createToken(
      { userId, role, id ,organizationId },
      config.jwt.secret as string,
      config.jwt.expires_in as string,
    );
    const refreshToken = jwtHelpers.createToken(
      { userId, role, id ,organizationId },
      config.jwt.refresh_secret as string,
      config.jwt.refresh_expires_in as string,
    );
    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string) {
    let verifiedToken = null;
    try {
      verifiedToken = await jwtHelpers.verifyToken(
        token,
        config.jwt.refresh_secret,
      );
    } catch (err) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'Invalid Refresh Token');
    }

    const { userId } = verifiedToken;
    const isUserExist = await this.usersRepository.findOne({
      where: { userId: userId },
    });
    if (!isUserExist) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'User does not exist');
    }
    const { role, id } = isUserExist;

    const newAccessToken = jwtHelpers.createToken(
      { userId, role, id },
      config.jwt.secret as string,
      config.jwt.expires_in as string,
    );
    return {
      accessToken: newAccessToken,
    };
  }

  async getProfile(user) {
    // console.log(user, 'user');
    let result: Users;
    if (user) {
      result = await this.usersRepository.findOne({
        where: { userId: user.employeeId },
        relations: ['employee'],
      });
    }
    return result;
  }
  // changePassword
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { oldPassword, newPassword, confirmNewPassword } = changePasswordDto;
    // console.log(userId);
    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const user = await this.usersRepository.findOne({
      where: { userId: userId },
      relations: ['employee'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (oldPassword != user.password) {
      throw new UnauthorizedException('Old password is incorrect');
    }

    user.password = await newPassword;
    await this.usersRepository.save(user);
  }
}
