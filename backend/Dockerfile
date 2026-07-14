# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ────────────────────────────────────────────────────────────────
# Development — source is bind-mounted by docker-compose, so only
# dependencies are installed here. `tsx watch` handles hot reload.
# ────────────────────────────────────────────────────────────────
FROM base AS dev
RUN npm ci
EXPOSE 8000
CMD ["npm", "run", "dev"]

# ────────────────────────────────────────────────────────────────
# Build — compiles TypeScript to dist/
# ────────────────────────────────────────────────────────────────
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# ────────────────────────────────────────────────────────────────
# Production — only runtime deps + compiled output, runs as non-root
# ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8000
CMD ["node", "dist/server.js"]
