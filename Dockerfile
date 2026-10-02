# ---------------- Next.js Web Frontend ----------------
FROM node:24-bookworm-slim AS web-deps
WORKDIR /app
ENV TZ=Asia/Seoul NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS web-builder
WORKDIR /app
ENV TZ=Asia/Seoul NEXT_TELEMETRY_DISABLED=1
COPY --from=web-deps /app/node_modules ./node_modules
COPY frontend ./
RUN npm run build

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV TZ=Asia/Seoul NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production PORT=3000
COPY --from=web-builder /app/package.json /app/package-lock.json ./
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/.next ./.next
COPY --from=web-builder /app/public ./public
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]

# ---------------- Spring Boot API Backend ----------------
FROM gradle:8.12-jdk21 AS api-builder
WORKDIR /workspace
COPY backend/settings.gradle.kts backend/build.gradle.kts ./
COPY backend/src ./src
RUN gradle --no-daemon build -x test && cp build/libs/*-SNAPSHOT.jar /app.jar

FROM eclipse-temurin:21-jre-alpine AS api
RUN apk add --no-cache curl tzdata && addgroup -S app && adduser -S -G app app
ENV TZ=Asia/Seoul
WORKDIR /app
COPY --from=api-builder --chown=app:app /app.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
