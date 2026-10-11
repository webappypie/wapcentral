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

# Copy dependency manifests and root TypeScript configuration
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json tsconfig.base.json version.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY services ./services
COPY apps ./apps

ARG SERVICE=admin-api

# Install monorepo dependencies and build workspace
RUN pnpm install --frozen-lockfile

# Ensure all workspace dependency packages are built before the service
RUN pnpm --filter "./packages/*" build
RUN pnpm --filter @wapcentral/workers build
RUN pnpm --filter @wapcentral/${SERVICE} build

# -------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# -------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG SERVICE=admin-api
ENV SERVICE_NAME=${SERVICE}
ENV NODE_PATH="/app/node_modules:/app/services/${SERVICE}/node_modules"

# Copy workspace dependencies and built distribution
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/workers ./services/workers
COPY --from=builder /app/services/${SERVICE} ./services/${SERVICE}
COPY --from=builder /app/services/${SERVICE}/dist ./dist
COPY --from=builder /app/services/${SERVICE}/package.json ./package.json

# Link workspace packages and service-level dependencies into root node_modules
RUN mkdir -p ./node_modules/@wapcentral && \
    for pkg in packages/*; do \
      [ -d "$pkg" ] && ln -sf "/app/$pkg" "./node_modules/@wapcentral/$(basename "$pkg")"; \
    done && \
    if [ -d "/app/services/workers" ]; then \
      ln -sf "/app/services/workers" "./node_modules/@wapcentral/workers"; \
    fi && \
    if [ -d "/app/services/${SERVICE}/node_modules" ]; then \
      for mod in /app/services/${SERVICE}/node_modules/*; do \
        name="$(basename "$mod")"; \
        if [ "$name" = "@google-cloud" ]; then \
          mkdir -p "./node_modules/@google-cloud"; \
          for sub in "$mod"/*; do \
            [ -e "$sub" ] && ln -sf "$sub" "./node_modules/@google-cloud/$(basename "$sub")"; \
          done; \
        elif [ "$name" != "@wapcentral" ] && [ ! -e "./node_modules/$name" ]; then \
          ln -sf "$mod" "./node_modules/$name"; \
        fi; \
      done; \
    fi

EXPOSE 8080
CMD ["node", "dist/index.js"]
