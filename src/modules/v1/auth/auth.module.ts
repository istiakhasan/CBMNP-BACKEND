import { Module } from '@nestjs/common';
import { AuthenTicationController } from './auth.controller';
import { AuthenTicationService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAuth } from './entities/auth.entity';
import { UserService } from './auth.utils';
import { Users } from '../user/entities/user.entity';


@Module({
  imports: [TypeOrmModule.forFeature([UserAuth]),TypeOrmModule.forFeature([Users])],
  controllers: [AuthenTicationController],
  providers: [AuthenTicationService,UserService], 
})
export class AuthModule {}