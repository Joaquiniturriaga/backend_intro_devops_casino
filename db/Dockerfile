# ──────────────────────────────────────────────────────────────
# Imagen de PostgreSQL con el schema inicial embebido
# Postgres ejecuta automaticamente cualquier .sql en:
#   /docker-entrypoint-initdb.d/
# la primera vez que arranca con un volumen vacio
# ──────────────────────────────────────────────────────────────
FROM postgres:16-alpine

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 5432