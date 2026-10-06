# syntax=docker/dockerfile:1

# ── Stage 1: install dependencies and compile TypeScript ──
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ── Stage 2: runtime (compiled JS + production dependencies only) ──
# Audio is decoded and streamed by Lavalink, so the bot needs no ffmpeg or build toolchain.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
CMD ["node", "dist/index.js"]
