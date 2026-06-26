import * as dotenv from 'dotenv';
// Carrega o .env com precedência sobre variáveis de ambiente já existentes no SO
// (a máquina tem uma DATABASE_URL global de outro projeto que conflitaria).
dotenv.config({ override: true });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Em produção, restrinja às origens do frontend via CORS_ORIGIN (lista separada por vírgula).
  // Sem a variável (dev), libera todas as origens.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    corsOrigin
      ? { origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }
      : {},
  );

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0'); // 0.0.0.0 para funcionar em containers/hospedagem
  // eslint-disable-next-line no-console
  console.log(`TransportaBR API rodando na porta ${port}`);
}
bootstrap();
