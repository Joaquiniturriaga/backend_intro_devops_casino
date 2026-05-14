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
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --from=builder --chown=nginx:nginx /app/dist/casino-frontend/browser/. /usr/share/nginx/html/
COPY --chown=nginx:nginx default.conf.template /etc/nginx/templates/default.conf.template

USER nginx
EXPOSE 8080

CMD ["node", "src/server.js"]