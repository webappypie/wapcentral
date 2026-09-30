# Multi-stage Dockerfile for WAPCentral Services
# Phase 13 — Production Release

FROM node:18-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# -------------------------------------------------------------
# Stage 1: Build packages and selected service
# -------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Copy dependency manifests
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps

ARG SERVICE=admin-api

# Install monorepo dependencies and build workspace
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wapcentral/${SERVICE} build

# -------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# -------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG SERVICE=admin-api
ENV SERVICE_NAME=${SERVICE}

# Copy workspace dependencies and built distribution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/${SERVICE}/dist ./dist
COPY --from=builder /app/services/${SERVICE}/package.json ./package.json

EXPOSE 8080
CMD ["node", "dist/index.js"]
