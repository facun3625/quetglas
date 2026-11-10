# Manual del panel (tienda modelo)

El manual (`src/content/manual-tienda-modelo.html`, que se sirve en `/manual`) se genera acá y tiene dos partes: el panel de administración y lo que hace el comprador. No lleva marcas ni datos reales. El manual anterior de Cortopassi (`src/content/manual-cortopassi.html`) se conserva en `/manual/anterior` y no lo toca este generador.

1. **Base de demostración:** `DATABASE_URL=postgresql://…/tienda_demo node tests/e2e/run.cjs docs/manual/seed-demo.ts` (crea "Tienda Modelo" con datos inventados y logo "Tu logo").
2. **Levantar la app contra esa base** (`DATABASE_URL=…/tienda_demo_e2e npm run dev`) y sacar las capturas:
   `node docs/manual/capturas.cjs` y `node docs/manual/capturas-2.cjs` (guardan WebP en `shots/`). `hoja.cjs` arma una hoja de contactos para revisarlas.
   Y la tienda vista por el comprador (inicio, ficha, carrito, checkout y "Mi cuenta"): `node docs/manual/capturas-3.cjs`.
3. **Armar el HTML:** `python3 docs/manual/build-manual.py` (incrusta las capturas; falla si aparece alguna marca ajena).

Nunca sacar capturas de la base de desarrollo real.
