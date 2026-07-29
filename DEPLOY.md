# Despliegue en Render — Urban Blade API

Guía para desplegar el backend en [Render](https://render.com). El repo ya incluye
un `render.yaml` (blueprint) que autoconfigura el servicio.

## Requisitos previos

- El repo en GitHub (`urban-blade-backend`), rama `main`.
- Una base de datos **MongoDB Atlas** accesible desde internet (ver §4).
- Las credenciales de Cloudinary, Firebase, SMTP (Brevo) y Stripe listas.

## 1. Crear el servicio en Render

Dos formas:

### Opción A — Blueprint (recomendada, usa `render.yaml`)

1. En Render: **New → Blueprint**.
2. Conecta tu repo de GitHub y elige la rama `main`.
3. Render detecta el `render.yaml` y propone crear el servicio `urban-blade-api`.
4. Te pedirá rellenar las variables marcadas como secretas (las de `sync: false`).
   Ver §3.

### Opción B — Manual (Web Service)

1. **New → Web Service** → conecta el repo.
2. Configura:
   - **Runtime:** Node
   - **Build Command:** `corepack enable && pnpm install --frozen-lockfile && pnpm build`
   - **Start Command:** `pnpm start:prod`
   - **Health Check Path:** `/api/health`
3. Añade las variables de entorno (§3).

## 2. Cómo arranca (ya está preparado en el código)

- La app escucha en **`0.0.0.0`** y en el **`PORT`** que inyecta Render (no hay que
  fijarlo; se lee del entorno).
- Health check en **`GET /api/health`** — Render lo consulta para saber si el
  servicio está vivo.
- **Degradación elegante:** si falta alguna credencial opcional (Firebase, SMTP,
  Stripe), la app arranca igual; esa función queda desactivada y se registra en log.
  Solo `MONGODB_URI` y los secretos JWT son imprescindibles para funcionar.

## 3. Variables de entorno (panel de Render → Environment)

`PORT` y `NODE_ENV` los gestiona Render / el blueprint. El resto:

| Variable | Obligatoria | Notas |
|---|---|---|
| `MONGODB_URI` | ✅ | Cadena de MongoDB Atlas |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✅ | **Usa secretos largos y aleatorios**, no los de prueba. Genera con `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | — | 15m / 7d (por defecto) |
| `GOOGLE_CLIENT_ID` | si usas Google Sign-In | |
| `CLOUDINARY_*` | si usas subida de imágenes | |
| `FIREBASE_*` | si usas push | `FIREBASE_PRIVATE_KEY` con `\n` literales (el backend los convierte) |
| `SMTP_*` / `MAIL_FROM` / `RESET_URL_BASE` | si usas correo | Ver §5 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_CURRENCY` | si usas pagos | Ver §6 |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | — | Rate limiting |

> **Nunca** subas el `.env` al repo (ya está en `.gitignore`). Las variables se
> configuran solo en el panel de Render.

## 4. MongoDB Atlas — permitir el acceso desde Render

Render usa IPs dinámicas. En Atlas → **Network Access**, añade `0.0.0.0/0` (permitir
desde cualquier IP) **o** las IPs salientes estáticas de Render si tu plan las tiene.
Sin esto, el backend no podrá conectar a la base de datos.

## 5. Correo (Brevo) en producción

- Autoriza la IP saliente de Render en Brevo (**Authorized IPs**) o desactiva la
  restricción por IP. Si no, verás `525 Unauthorized IP address`.
- `MAIL_FROM` debe ser un remitente **verificado** en Brevo.

## 6. Webhook de Stripe en producción (¡importante!)

En local usabas `stripe listen`. En producción **ya no hace falta** — registra el
webhook directamente en Stripe apuntando a tu URL pública de Render:

1. Copia la URL pública que te da Render (p. ej. `https://urban-blade-api.onrender.com`).
2. En Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
   - URL: `https://<tu-servicio>.onrender.com/api/payments/stripe/webhook`
   - Evento: `payment_intent.succeeded`
3. Stripe te da un `whsec_...` de **producción** → ponlo en `STRIPE_WEBHOOK_SECRET`
   en Render.

### Webhook de compras de productos (orders)

Las compras de productos tienen un **endpoint aparte** en Stripe:
`https://<tu-servicio>.onrender.com/api/orders/stripe/webhook` (mismo evento
`payment_intent.succeeded`).

⚠️ **Stripe genera un signing secret DISTINTO por cada endpoint.** El del webhook
de productos NO es el mismo que el de servicios. Ponlo en una variable aparte:
`STRIPE_WEBHOOK_SECRET_ORDERS` (con el `whsec_...` de ese endpoint). El backend
verifica la firma probando ambos secretos, así cada webhook valida con el suyo. Si
solo usas pagos de servicios, no necesitas esta variable.

## 7. Verificar el despliegue

- Al terminar el deploy, abre `https://<tu-servicio>.onrender.com/api/health` →
  debe responder `{ success: true, ... status "ok" }`.
- La documentación Swagger queda en `https://<tu-servicio>.onrender.com/api/docs`.
- Revisa los logs en Render → pestaña **Logs**; deberías ver "Firebase/Stripe/SMTP
  inicializado" (o el aviso de "no configurado" si omitiste alguno).

## 8. Notas

- **Plan free:** el servicio se **duerme** tras ~15 min de inactividad y tarda unos
  segundos en despertar en la primera petición. Los **crons** (`@nestjs/schedule`:
  recordatorios, auto-cancelaciones, expiración de fila) **no corren mientras está
  dormido**. Para que los crons funcionen 24/7, sube a un plan de pago.
- **Seed inicial:** si necesitas datos base, corre `pnpm seed` una vez (localmente
  contra la BD de producción, o como un Job en Render). Revisa qué crea antes.
- **CORS:** hoy acepta cualquier origen (`origin: true`). Para la app móvil (Expo) no
  afecta. Si expones un front web, considera restringirlo más adelante.
