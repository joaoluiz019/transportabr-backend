# ---- Build ----
FROM node:20-slim AS build
WORKDIR /app
# openssl é necessário para o Prisma gerar/usar o query engine
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# npm install (não npm ci): não depende de um package-lock.json versionado/consistente
# (o lock está no .gitignore deste repo).
RUN npm install
COPY . .
RUN npx prisma generate && npm run build

# ---- Runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./
EXPOSE 3000
# Aplica migrations pendentes e sobe a API. As variáveis (DATABASE_URL, JWT_SECRET, etc.)
# vêm do ambiente do provedor — NÃO há .env na imagem.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
