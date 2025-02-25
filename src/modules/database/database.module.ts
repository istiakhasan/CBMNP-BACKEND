// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { join } from 'path';

// @Module({
//   imports: [
//     TypeOrmModule.forRoot({
//       type: 'postgres',
//       host: "pg-1acd2627-istieak-063f.i.aivencloud.com",
//       port: 11261,
//       username:process.env.USERNAME,
//       password: process.env.AIVEN_SERVICE_PASSWORD,
//       database: "defaultdb",
//       entities: [join(process.cwd(), '/dist/**/*.entity.js')],
//       synchronize: true,
//       logging: false,
//       ssl: {
//         rejectUnauthorized: false,
//       },
//     })
    
//   ],
// })
// export class DatabaseModule {}


import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv'; 

dotenv.config(); // Load .env variables

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

