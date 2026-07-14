# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ────────────────────────────────────────────────────────────────
# Development — source is bind-mounted by docker-compose, so only
# dependencies are installed here. Vite's own dev server + HMR
# handles hot reload; `server.host` in vite.config.ts makes it
# reachable from outside the container.
# ────────────────────────────────────────────────────────────────
FROM base AS dev
RUN npm ci
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ────────────────────────────────────────────────────────────────
# Build — VITE_* vars are inlined into the JS bundle at build time,
# so they're taken as build args rather than relying on a .env file
# being present in the (secret-free) build context.
# ────────────────────────────────────────────────────────────────
FROM base AS build
ARG VITE_API_BASE_URL=http://localhost:8000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm ci
COPY . .
RUN npm run build

# ────────────────────────────────────────────────────────────────
# Production — static bundle served by nginx
# ────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
