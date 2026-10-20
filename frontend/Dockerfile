# ---- Base ----
FROM node:24-alpine AS base
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Install system dependencies needed for both build & runtime
RUN apk add --no-cache netcat-openbsd bash

# Copy package.json and package-lock.json for dependency install
COPY package*.json ./

# ---- Install Dependencies ----
# Install only what is needed based on NODE_ENV
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN if [ "$NODE_ENV" = "production" ]; then \
      npm ci --omit=dev; \
    else \
      npm ci; \
    fi

# ---- Build Stage ----
FROM base AS build

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# Copy source files
COPY . .

# Only build in production
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm run build; \
      if [ ! -f ".next/prerender-manifest.json" ]; then \
        echo '{"version":3,"routes":{},"dynamicRoutes":{},"notFoundRoutes":[],"preview":{"previewModeId":"development-id","previewModeSigningKey":"development-key","previewModeEncryptionKey":"development-key"}}' > .next/prerender-manifest.json; \
      fi; \
    else \
      echo "Skipping production build in development"; \
    fi

# ---- Runtime Stage ----
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=${NODE_ENV}

# Copy everything from build stage: node_modules, .next, public, package.json, entrypoint
COPY --from=build /app /app

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Ensure prerender-manifest.json exists in runtime (Next.js 15.x fix)
# This must be done before switching to node user to avoid permission issues
RUN if [ ! -f ".next/prerender-manifest.json" ]; then \
      echo '{"version":3,"routes":{},"dynamicRoutes":{},"notFoundRoutes":[],"preview":{"previewModeId":"development-id","previewModeSigningKey":"development-key","previewModeEncryptionKey":"development-key"}}' > .next/prerender-manifest.json; \
    fi

# Fix ownership of specific directories that need write access
RUN chown -R node:node /app/.next /app/node_modules /app/entrypoint.sh

# Use non-root user
USER node

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
