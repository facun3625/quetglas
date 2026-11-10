#!/usr/bin/env bash
# Deploy en el VPS. Correr parado en la carpeta del proyecto
# (~/cortopassi-tienda/cortopassi-tienda) o desde cualquier lado, da igual.
#
# Uso:
#   bash scripts/deploy.sh
#   npm run deploy          (atajo, ver package.json)
#
# Variable opcional PM2_APP para usar otro nombre de proceso pm2 (por defecto "cortopassi"):
#   PM2_APP=otro-nombre bash scripts/deploy.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PM2_APP="${PM2_APP:-cortopassi}"

cd "$APP_DIR"

# Una DATABASE_URL exportada en la sesión (de otro proyecto del mismo VPS) pisa la del
# .env y las migraciones irían a la base equivocada. Se descarta para que se use siempre
# la del .env de ESTE proyecto.
unset DATABASE_URL
if [ -f .env ]; then
  echo "==> base de datos de este deploy: $(grep -E '^DATABASE_URL=' .env | sed -E 's#://[^@]*@#://***@#; s#\?.*##')"
fi

echo "==> [1/6] git pull"
git pull

echo "==> [2/6] npm install"
npm install

echo "==> [3/6] prisma migrate deploy"
npx prisma migrate deploy

echo "==> [4/6] limpiando build viejo (.next)"
rm -rf .next

echo "==> [5/6] npm run build"
npm run build

echo "==> [6/6] reiniciando pm2 ($PM2_APP)"
pm2 restart "$PM2_APP"

echo ""
echo "✅ Deploy listo. Últimas líneas de log:"
pm2 logs "$PM2_APP" --lines 15 --nostream
