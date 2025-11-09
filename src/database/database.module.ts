import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        // entities: [join(process.cwd(), '/dist/**/*.entity.js')],
        entities: [join(__dirname, '/../**/*.entity{.ts,.js}')],
        // dont use synchronize: ture in real projects
        // ssl: { rejectUnauthorized: false },
        synchronize: true,
        // synchronize: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
