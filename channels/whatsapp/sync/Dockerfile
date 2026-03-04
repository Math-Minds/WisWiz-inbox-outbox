# ---------- builder ----------
FROM node:22 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY sync/ ./sync/

# ---------- runner ----------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# tsx for running TypeScript directly
RUN npm install -g tsx

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/sync ./sync

EXPOSE 8080
CMD ["tsx", "sync/index.ts"]
