# syntax=docker/dockerfile:1

# ---- build stage: install everything, compile TypeScript, then keep only production dependencies ----
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Replace node_modules with production-only dependencies (no compiler, test tools or linters).
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# ---- runtime stage: a small image that only runs the compiled app ----
FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Uploaded photos are written here; compose mounts a volume on it so they survive restarts.
ENV UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# Don't run as root inside the container.
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main"]
