# 1. Dependencies
FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV TZ=Asia/Seoul NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 2. Builder
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV TZ=Asia/Seoul NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY frontend ./
RUN npm run build

# 3. Runner
FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV TZ=Asia/Seoul NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production PORT=3000
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
