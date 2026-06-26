# TransportaBR — Backend (NestJS + Prisma + PostgreSQL)

API do TransportaBR. Projeto **separado** do frontend (que fica em `../transportabr/transportabr`).
O frontend conversa com esta API por HTTP (`VITE_API_URL`) — não há dependência de arquivos entre eles.

## Rodando localmente
```bash
npm install
npm run prisma:generate
npm run start:dev        # API em http://localhost:3000
```
Variáveis em `.env` (veja `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`,
`APPLE_CLIENT_ID`, `SMTP_*`, `APP_URL`.

> Obs.: a máquina tem uma `DATABASE_URL` global no SO que conflita com o Prisma; os scripts npm já
> usam `dotenv -e .env -o` (override) para priorizar o `.env` deste projeto.

## Scripts úteis
- `npm run start:dev` — API em watch.
- `npm run build` / `npm run start:prod` — build e execução de produção.
- `npm run prisma:migrate` — cria/aplica migrations (dev).
- `npm run prisma:deploy` — aplica migrations em produção.
- `npm run prisma:studio` — inspeciona o banco.
- `npm run import:csv` — importa os CSVs do Base44 (remapeia ObjectId→UUID).
- `npm run token -- <email>` — gera um JWT de teste para um usuário existente.

## Banco
PostgreSQL. Modelagem em `prisma/schema.prisma` (PKs/FKs em UUID). Migrations em `prisma/migrations`.
Para subir um Postgres local (se não usar o remoto): `npm run db:up` (docker-compose).

## Deploy
- Defina as variáveis de ambiente no provedor (Render/Railway/VPS/etc.).
- `npm run build` e rode `node dist/main.js` (ou `npm run start:prod`).
- Rode as migrations com `npm run prisma:deploy`.
- Habilite CORS apenas para a origem do frontend em produção (hoje está liberado para `*`).
