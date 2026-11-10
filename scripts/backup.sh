#!/usr/bin/env bash
# Backup de la tienda: base de datos (pg_dump) + archivos subidos al disco
# (comprobantes de transferencia, imágenes del slider/mails/pop-up y, si no usás R2, las del catálogo).
#
# Uso:    bash scripts/backup.sh
# Cron:   0 3 * * * cd /root/cortopassi-tienda/cortopassi-tienda && bash scripts/backup.sh >> /var/log/tienda-backup.log 2>&1
#
# Variables (todas opcionales):
#   BACKUP_DIR     carpeta destino            (default: ~/backups/tienda)
#   KEEP_DAYS      días que se conservan      (default: 14)
#   DB_CONTAINER   si la base corre en Docker, nombre del contenedor (ej. tienda-db). Si no se define, se usa
#                  pg_dump con DATABASE_URL del .env.
#   R2_BACKUP_BUCKET  si se define (y está instalado `aws` con credenciales R2 en R2_ACCESS_KEY_ID /
#                  R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID), también sube el backup a ese bucket.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# Carga .env (sin exportar comentarios) para tener DATABASE_URL y R2_*
if [ -f .env ]; then set -a; . ./.env; set +a; fi

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/tienda}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

DB_FILE="$BACKUP_DIR/db-$STAMP.sql.gz"
echo "==> [1/4] Base de datos -> $DB_FILE"
if [ -n "${DB_CONTAINER:-}" ]; then
  # Usuario y base salen de DATABASE_URL: postgresql://user:pass@host:port/db?schema=public
  DB_USER="$(echo "$DATABASE_URL" | sed -E 's#^[a-z]+://([^:]+):.*#\1#')"
  DB_NAME="$(echo "$DATABASE_URL" | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#')"
  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --clean --if-exists | gzip > "$DB_FILE"
else
  pg_dump "${DATABASE_URL%%\?*}" --no-owner --clean --if-exists | gzip > "$DB_FILE"
fi
# Un dump vacío o corrupto no sirve: se verifica que descomprima y tenga contenido
if ! gzip -t "$DB_FILE" || [ "$(gzip -dc "$DB_FILE" | head -c 200 | wc -c)" -lt 100 ]; then
  echo "ERROR: el backup de la base salió vacío o corrupto" >&2
  rm -f "$DB_FILE"
  exit 1
fi

FILES_ARCHIVE="$BACKUP_DIR/uploads-$STAMP.tar.gz"
echo "==> [2/4] Archivos subidos -> $FILES_ARCHIVE"
if [ -d public/uploads ]; then
  tar -czf "$FILES_ARCHIVE" public/uploads
else
  echo "    (no hay public/uploads, se omite)"
fi

echo "==> [3/4] Rotación: se borran backups de más de $KEEP_DAYS días"
find "$BACKUP_DIR" -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

if [ -n "${R2_BACKUP_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "==> [4/4] Copia fuera del servidor (R2: $R2_BACKUP_BUCKET)"
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
  ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
  aws s3 cp "$DB_FILE" "s3://$R2_BACKUP_BUCKET/backups/" --endpoint-url "$ENDPOINT"
  [ -f "$FILES_ARCHIVE" ] && aws s3 cp "$FILES_ARCHIVE" "s3://$R2_BACKUP_BUCKET/backups/" --endpoint-url "$ENDPOINT"
else
  echo "==> [4/4] Copia externa omitida (definí R2_BACKUP_BUCKET y tené instalado aws para activarla)"
fi

echo "✅ Backup listo: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
