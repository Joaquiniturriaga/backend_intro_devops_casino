# ──────────────────────────────────────────────────────────────
# ETAPA 1 — builder: instala dependencias
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos primero (cache de capas)
COPY package*.json ./

# --omit=dev instala solo dependencias de produccion (sin devDependencies)
RUN npm install --omit=dev

# Copiar codigo fuente
COPY src ./src

# ──────────────────────────────────────────────────────────────
# ETAPA 2 — runtime: imagen final limpia
# La imagen final no tiene npm ni el toolchain de build
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Copiar solo lo necesario desde builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

# ── Usuario no root ───────────────────────────────────────────
# node:20-alpine ya incluye el usuario 'node' (uid 1000)
# Cambiar ownership antes de hacer USER
RUN addgroup -S app && adduser -S app -G app
RUN chown -R app:app /app
USER app
# Verificar: docker exec <contenedor> whoami  →  debe responder 'app'

EXPOSE 3000

CMD ["node", "src/server.js"]