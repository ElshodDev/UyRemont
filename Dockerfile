# syntax=docker/dockerfile:1
# =============================================
# Usta24 - production imijlari (deploy/docker-compose.yml ishlatadi)
#   backend - Node.js API, Socket.io, dispetcher, Telegram bot
#   web     - Caddy: sayt fayllari, HTTPS sertifikati, /api ni backendga uzatish
# =============================================

# ---------- 1. Sayt (React) build ----------
FROM node:22-bookworm-slim AS web-build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# Havola ko'rinishi (og:image) uchun saytning to'liq manzili, masalan https://usta24.uz
ARG PUBLIC_APP_URL=
ENV PUBLIC_APP_URL=${PUBLIC_APP_URL}
RUN npm run build

# ---------- 2. Backend ----------
FROM node:22-bookworm-slim AS backend
ENV NODE_ENV=production
# Havola kartochkasidagi (og.png) matn uchun shriftlar: Inter (saytdagi shrift), bo'lmasa DejaVu
RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
    && (apt-get install -y --no-install-recommends fonts-inter || echo "fonts-inter topilmadi: DejaVu ishlatiladi") \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY backend/ ./
# /u/<usta> sahifasi uchun saytning index.html shabloni (meta teglar serverda yoziladi)
COPY --from=web-build /src/web/dist/index.html /app/web/dist/index.html
# Yuklangan rasmlar va hujjatlar alohida diskda (docker volume) saqlanadi
RUN mkdir -p /data/uploads /data/private/orders /data/private/documents && chown -R node:node /data
ENV PORT=5000 \
    UPLOAD_DIR=/data/uploads \
    ORDER_PHOTO_DIR=/data/private/orders \
    MASTER_DOC_DIR=/data/private/documents \
    WEB_INDEX_HTML=/app/web/dist/index.html
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Har ishga tushishda baza sxemasi yangilanadi (o'zgarishlar qayta bajarilsa ham xavfsiz), keyin server
CMD ["sh", "-c", "node scripts/db-setup.js && exec node server.js"]

# ---------- 3. Veb-server: sayt + HTTPS ----------
FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /src/web/dist /srv
