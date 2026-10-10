# syntax=docker/dockerfile:1

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dépendances d'abord, pour profiter du cache Docker.
# Les devDependencies sont conservées : le bot s'exécute avec tsx (import
# TypeScript sans extensions), qui est déclaré dans devDependencies.
COPY package.json package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

# Ne pas tourner en root.
USER node

# Configuration (token Discord, PGUSER, PGPASSWORD, PGHOST, PGDATABASE…)
# fournie à l'exécution, par exemple avec : docker run --env-file .env …
CMD ["node", "--import", "tsx", "src/index.ts"]
