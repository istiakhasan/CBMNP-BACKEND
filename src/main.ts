import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodFilter } from './middleware/ZodFilter';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://192.168.10.168:3000',
    'https://gb-storefront-8r4z.vercel.app',
    'https://ghorer-bazar-erp.vercel.app',
    'https://gb-subscription.vercel.app',
    'https://erp.ghorerbazartech.xyz',
    'http://192.168.10.134:3001',
    'http://192.168.10.130:3001',
    'https://erp.ghorerbazartech.xyz',
    process.env.NEXTJS_FRONTEND_URL,
    process.env.SSLCOMMERZ_BASE_API,
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (allowedOrigins.includes(origin) || !origin || origin === 'null') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies to be sent and received
  });
  
  app.useGlobalFilters(new ZodFilter())
  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
