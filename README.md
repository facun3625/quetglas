# Cortopassi - Tienda

Tienda online con catálogo propio (productos simples y variables, categorías en árbol, atributos),
checkout con varios medios de pago, panel de administración y migración única desde WooCommerce.

Next.js 16 · React 19 · Prisma 7 + PostgreSQL · NextAuth · Tailwind 4 · Cloudflare R2 para imágenes.

## Desarrollo

```bash
cp .env.example .env          # completar DATABASE_URL, NEXTAUTH_URL y AUTH_SECRET
npm install
npx prisma migrate deploy     # aplica las migraciones
npm run dev                   # http://localhost:3000
```

El primer usuario administrador se crea registrándose en `/registro` y cambiando su rol a `admin`
directamente en la base (`UPDATE "User" SET role = 'admin' WHERE email = '...';`). Después se
administra desde `/admin/usuarios`.

Tests: `node --test tests/` (checkout, imágenes, recuperación de contraseña). Las pruebas de punta a
punta contra una base real están en `tests/e2e/` (`DATABASE_URL=... node tests/e2e/run.cjs <archivo>`,
usan una base descartable `<nombre>_e2e` que se crea sola: nunca tocan la tuya).

## Primeros pasos en el panel

1. **Configuración → General**: moneda de la tienda (ARS o USD), contacto y categorías destacadas.
2. **Pagos** y **Envíos**: activar los medios que se usen.
3. **Productos**: cargar el catálogo a mano, por CSV, o desde **Migración Woo** si viene de WooCommerce.
4. **Configuración → Correo (SMTP / Resend)**: proveedor de correo, uno de los dos (necesario para recuperar contraseñas). **Configuración → Vendedora IA**: proveedor, modelo y API key de la IA, si se usa.

## Documentación

- [MANUAL_TIENDA.md](MANUAL_TIENDA.md): manual de uso del panel y de la tienda.
- [PRESENTACION_FUNCIONAL_Y_TECNICA.md](PRESENTACION_FUNCIONAL_Y_TECNICA.md): alcance funcional y arquitectura.
- [guia_nueva_app.md](guia_nueva_app.md): cómo subir la app al VPS.
- [telegram-avisos-instalacion.md](telegram-avisos-instalacion.md): avisos de ventas por Telegram.
