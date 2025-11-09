import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv'; 


dotenv.config();
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [join(process.cwd(), '/dist/**/*.entity.js')],
      synchronize: true,
      logging: false,
       ssl: { 
        rejectUnauthorized: false,
      },
    }),
    
  ],
})
export class DatabaseModule {}

