#!/usr/bin/env bash
# Dispara la copia de seguridad automática de la app (la misma del panel). Pensado para cron:
#   30 3 * * * /root/cortopassi/cortopassi/scripts/run-backup.sh >> /root/backup-cron.log 2>&1
# Lee BACKUP_SECRET del .env de este proyecto (no hace falta escribirlo en el crontab).
# Por defecto llama a http://127.0.0.1:3017; con otro puerto: APP_URL=http://127.0.0.1:PUERTO

set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_URL="${APP_URL:-http://127.0.0.1:3017}"

SECRET="$(grep -E '^BACKUP_SECRET=' "$APP_DIR/.env" | head -n1 | cut -d= -f2- | tr -d '"'"'" )"
if [ -z "$SECRET" ]; then
  echo "$(date +%Y-%m-%dT%H:%M:%S%z) ERROR: no hay BACKUP_SECRET en $APP_DIR/.env" >&2
  exit 1
fi

RESP="$(curl -sS --max-time 900 -X POST -H "Authorization: Bearer $SECRET" "$APP_URL/api/backups/cron")"
echo "$(date +%Y-%m-%dT%H:%M:%S%z) $RESP"
case "$RESP" in *'"ok":true'*) exit 0 ;; *) exit 1 ;; esac
