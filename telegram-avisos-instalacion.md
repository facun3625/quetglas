# Cómo activar los avisos de Telegram en Cortopassi - Tienda

Esta guía es para armar el bot de Telegram y conseguir los **dos datos** que después hay que pegar en el panel (`/admin/configuracion` → pestaña **Telegram**): el **token del bot** y el **ID del chat/grupo**.

No hace falta saber programar — son todo pasos dentro de la app de Telegram, salvo el paso 6 que es pegar una URL en el navegador.

---

## Paso 1 — Hablar con @BotFather

1. Abrí Telegram (en el celular o en la web, [web.telegram.org](https://web.telegram.org)).
2. Buscá el usuario **@BotFather** (es el bot oficial de Telegram para crear bots — tiene un tilde azul de verificado).
3. Abrí el chat y tocá **Iniciar** (o mandale `/start`).

## Paso 2 — Crear el bot

1. Mandale el mensaje: `/newbot`
2. Te va a pedir un **nombre** para el bot (el que se muestra, puede tener espacios). Por ejemplo: `Cortopassi - Tienda Avisos`
3. Te va a pedir un **username** (identificador único, sin espacios, tiene que terminar en `bot`). Por ejemplo: `cortopassi_avisos_bot`
   - Si ese username ya lo agarró otro, te va a avisar — probá otra variante.

## Paso 3 — Guardar el token

Apenas lo creás, BotFather te manda un mensaje que dice algo como:

```
Done! Congratulations on your new bot...

Use this token to access the HTTP API:
7912345678:AAHx3kLp9-abcdEFGHijklMNOPqrstUVWX
```

**Ese número largo con `:` en el medio es el token.** Copialo y guardalo por ahora en cualquier lado (un mensaje a vos mismo, una nota) — es el primero de los dos datos que necesitás.

> ⚠️ Es una credencial secreta: quien la tenga puede mandar mensajes con tu bot. No la compartas fuera de este trámite.

## Paso 4 — Crear (o elegir) el grupo de avisos

1. En Telegram, creá un grupo nuevo (o usá uno que ya tengan con el equipo) — el lugar donde quieren que lleguen los avisos de "nueva venta".
2. Nombralo algo claro, por ejemplo: `Cortopassi - Tienda — Pedidos`.

## Paso 5 — Agregar el bot al grupo

1. Entrá al grupo → **Agregar miembro** (ícono de personas o el nombre del grupo → "Añadir miembro").
2. Buscá el bot por el **username** que elegiste en el paso 2 (ej. `cortopassi_avisos_bot`).
3. Agregalo. No hace falta darle rol de administrador, con que sea miembro alcanza.

## Paso 6 — Conseguir el ID del grupo

Este es el segundo dato. Se saca así:

1. Mandá cualquier mensaje al grupo (por ejemplo, "hola") — tiene que ser **después** de haber agregado el bot.
2. Abrí esta URL en el navegador, reemplazando `TU_TOKEN` por el token del paso 3 (tal cual, con los dos puntos incluidos):

   ```
   https://api.telegram.org/botTU_TOKEN/getUpdates
   ```

   Por ejemplo, si el token es `7912345678:AAHx3kLp9-abcdEFGHijklMNOPqrstUVWX`, la URL queda:

   ```
   https://api.telegram.org/bot7912345678:AAHx3kLp9-abcdEFGHijklMNOPqrstUVWX/getUpdates
   ```

3. Vas a ver un texto en formato JSON. Buscá (Ctrl+F / Cmd+F) la palabra `"chat"` — vas a encontrar algo así:

   ```json
   "chat": {
     "id": -1001234567890,
     "title": "Cortopassi - Tienda — Pedidos",
     "type": "supergroup"
   }
   ```

4. **El número de `"id"` (con el signo `-` incluido) es el ID del chat.** Los grupos siempre empiezan con `-100`. Ese es el segundo dato.

> Si la página sale vacía (`{"ok":true,"result":[]}`), es porque todavía no mandaste ningún mensaje al grupo después de agregar el bot — volvé al paso 6.1.

## Paso 7 — Cargarlo en Cortopassi - Tienda

1. Entrá al panel: `/admin/configuracion` → pestaña **Telegram**.
2. Pegá el **token del bot** (paso 3) en el campo "Token del bot".
3. Pegá el **ID del chat/grupo** (paso 6, con el `-` incluido) en "ID del chat / grupo".
4. Guardá.
5. Apretá **"Probar Telegram"** — si quedó todo bien, en unos segundos llega un mensaje de prueba al grupo. Si da error, te muestra el motivo (token mal copiado, o el bot no está en ese grupo).

---

### Resumen de los dos datos

| Dato | De dónde sale | Cómo se ve |
|---|---|---|
| **Token del bot** | Mensaje de @BotFather al crear el bot (paso 3) | `7912345678:AAHx3kLp9-abcd...` |
| **ID del chat/grupo** | `getUpdates` en el navegador, campo `"chat":{"id": ...}` (paso 6) | `-1001234567890` |
