import * as dotenv from 'dotenv';
// Carrega o .env com precedência sobre variáveis de ambiente já existentes no SO
// (a máquina tem uma DATABASE_URL global de outro projeto que conflitaria).
dotenv.config({ override: true });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`TransportaBR API rodando em http://localhost:${port}`);
}
bootstrap();
