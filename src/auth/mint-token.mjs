/**
 * Utilitário de DESENVOLVIMENTO: gera um JWT válido para um usuário existente,
 * para testar os endpoints antes do login real (Fase 3).
 *
 *   npm run token -- <email>
 *   (ex.: npm run token -- jefersonleandroinacio@gmail.com)
 */
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const email = process.argv[2];
if (!email) {
  console.error('Uso: npm run token -- <email>');
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { email } });
await prisma.$disconnect();

if (!user) {
  console.error(`Usuário não encontrado: ${email}`);
  process.exit(1);
}

const token = jwt.sign(
  { sub: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
);

console.log(token);
