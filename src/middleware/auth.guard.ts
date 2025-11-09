import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Secret } from 'jsonwebtoken';
import { ApiError } from './ApiError';
import { jwtHelpers } from '../helpers/jwtHelpers';



@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization;

    if (!token) {
      throw new UnauthorizedException('You are not authorized');
    }
    try {
      const verifiedUser = jwtHelpers.verifyToken(
        token,
        process.env.JWT_SECRET as Secret,
      );
      request.user = verifiedUser;
      if (roles && roles.length > 0 && !roles.includes(verifiedUser.role)) {
        throw new ForbiddenException('Forbidden');
      }
      return true;
    } catch (error) {
      throw error instanceof ForbiddenException
        ? error
        : new ApiError(419, 'Invalid token');
    }
  }
}
