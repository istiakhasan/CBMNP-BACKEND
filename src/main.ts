import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodFilter } from './middleware/ZodFilter';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['https://YOUR-APP-NAME.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization', // ✅ Added Authorization header
      'Authentication',
      'Access-Control-Allow-Credentials',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Origin',
      'User-Agent',
      'Referer',
      'Accept-Encoding',
      'Accept-Language',
      'Access-Control-Request-Headers',
      'Cache-Control',
      'Pragma',
      'x-organization-id',
    ],
  });

  app.useGlobalFilters(new ZodFilter());
  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('api');

  const PORT = Number(process.env.PORT) || 8080;
  await app.listen(PORT);

  console.log(`🚀 Server is running at http://localhost:${PORT}`);
}

bootstrap();
