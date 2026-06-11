# ---- CS Duel: tek imajda backend (Socket.IO) + frontend (public/) ----
# Frontend statik dosyalari server.js tarafindan Express ile servis edilir,
# Three.js CDN'den yuklenir; ayri bir build adimi yoktur. Tek process calisir.
FROM node:22-alpine

# Calisma dizini
WORKDIR /app

# Once sadece bagimlilik dosyalari -> katman onbellegi (kod degisince npm tekrar kosmaz)
COPY package.json package-lock.json* ./

# Yalnizca production bagimliliklari (express + socket.io). Lock varsa ci, yoksa install.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

# Uygulama kodu (server.js + public/)
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Konteyner saglik kontrolu: ana sayfa cevap veriyor mu?
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

# Tek komut: once backend ayaga kalkar, ardindan public/ frontend'ini servis eder
CMD ["node", "server.js"]
