import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodFilter } from './middleware/ZodFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ZodFilter())
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
