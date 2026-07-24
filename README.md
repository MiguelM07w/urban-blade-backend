# Urban Blade — Backend API

Backend de la aplicación móvil de la barbería **Urban Blade**, construido con NestJS y MongoDB.

## Stack

- **Framework:** NestJS 11 (TypeScript estricto)
- **Base de datos:** MongoDB Atlas + Mongoose
- **Autenticación:** JWT (access + refresh) + Passport, con Google Sign-In
- **Tiempo real:** WebSockets (Socket.io) para el chat
- **Push:** Firebase Cloud Messaging (firebase-admin)
- **Imágenes:** Cloudinary
- **Tareas programadas:** `@nestjs/schedule` (cron)
- **Documentación:** Swagger / OpenAPI
- **Gestor de paquetes:** pnpm

## Requisitos

- Node.js 20+ (probado con 22.19.0)
- pnpm 10+
- Una base de datos MongoDB (Atlas o local)

## Instalación

```bash
pnpm install
```

Copia el archivo de ejemplo de variables de entorno y complétalo:

```bash
cp .env.example .env
```

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default 3000) |
| `API_PREFIX` | Prefijo global de rutas (default `api`) |
| `MONGODB_URI` | Cadena de conexión de MongoDB Atlas |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | Secreto y expiración del access token (15m) |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Secreto y expiración del refresh token (7d) |
| `GOOGLE_CLIENT_ID` | Client ID de Google para validar el ID token del móvil |
| `CLOUDINARY_*` | Credenciales de Cloudinary (subida de imágenes) |
| `FIREBASE_*` | Service account de Firebase (push FCM) |
| `SMTP_*` / `MAIL_FROM` / `RESET_URL_BASE` | Correo (recuperación de contraseña, contacto) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_CURRENCY` | Pagos con tarjeta (Stripe) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limiting global |

> Cloudinary, Firebase, correo SMTP y Stripe son **opcionales en desarrollo**: si no se configuran, esa función se desactiva con degradación elegante (la subida de imágenes falla con un error claro, los push y correos se registran en log, y el pago con tarjeta responde "no disponible"). El resto de la API funciona con normalidad.

> ⚠️ La **Publishable Key** de Stripe (`pk_...`) NO va en el backend — es del frontend (Expo). El backend solo usa la clave secreta y la del webhook. Nunca subas tu `.env` real al repositorio (ya está en `.gitignore`).

### Webhook de Stripe (local)

Para que los pagos con tarjeta confirmen el ticket, expón el webhook con la CLI de Stripe (con el servidor corriendo):

```bash
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
```

Copia el `whsec_...` que imprime a `STRIPE_WEBHOOK_SECRET` en tu `.env` y reinicia el backend.

## Ejecución

```bash
pnpm start:dev     # desarrollo con recarga
pnpm build         # compila a dist/
pnpm start:prod    # ejecuta dist/main
```

- API: `http://localhost:3000/api`
- Documentación Swagger: `http://localhost:3000/api/docs`

## Convenciones de la API

### Prefijo

Todas las rutas HTTP cuelgan de `/api` (configurable con `API_PREFIX`).

### Formato de respuesta

Toda respuesta (éxito o error) sigue el mismo envoltorio, producido por un interceptor/filtro global:

```jsonc
{
  "success": true,
  "data": { /* payload real */ },
  "message": "Operación exitosa",
  "statusCode": 200,
  "timestamp": "2026-07-06T12:00:00.000Z"
}
```

En error, `success: false`, `data: null` y `message` describe el problema.

### Autenticación

- Rutas protegidas por defecto (guard JWT global). Las públicas están marcadas con `@Public()`.
- Enviar el token en el header: `Authorization: Bearer <accessToken>`.
- Control por rol: `client`, `barber`, `admin`.
- El login/registro devuelve:

```jsonc
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "name": "...", "email": "...", "role": "client", "avatar": "..." }
}
```

### Rate limiting

Límite global configurable (`THROTTLE_LIMIT` peticiones por `THROTTLE_TTL` ms).

## Módulos y endpoints

> Rutas relativas a `/api`. 🔒 = requiere autenticación · 👑 = solo admin · ✂️ = barbero

### auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registro con email/password |
| POST | `/auth/login` | Login con email/password |
| POST | `/auth/google` | Login con Google (ID token) |
| POST | `/auth/refresh` | Renovar access token |
| POST | `/auth/logout` 🔒 | Cerrar sesión |
| POST | `/auth/forgot-password` | Solicitar recuperación |
| POST | `/auth/reset-password` | Resetear con token |

### users
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/users` | Crear usuario |
| GET | `/users` 👑 | Listar usuarios |
| GET | `/users/:id` 🔒 | Obtener usuario |
| PATCH | `/users/:id` 🔒 | Actualizar perfil |
| PATCH | `/users/:id/fcm-token` 🔒 | Registrar token de push |
| DELETE | `/users/:id` 🔒 | Eliminar (soft delete) |
| GET | `/users/:id/history` 🔒 | Historial de cortes |
| GET | `/users/:id/favorites` 🔒 | Cortes favoritos |
| POST | `/users/:id/favorites/:hairstyleId` 🔒 | Guardar favorito |

### barbers
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/barbers` | Listar barberos activos |
| GET | `/barbers/:id` | Obtener barbero |
| GET | `/barbers/barber-of-the-day` | Barbero del día |
| GET | `/barbers/:id/portfolio` | Portafolio |
| GET | `/barbers/:id/schedule` | Horarios |
| POST | `/barbers` 👑 | Crear barbero |
| PATCH | `/barbers/:id` ✂️👑 | Actualizar |
| POST | `/barbers/:id/portfolio` ✂️👑 | Subir foto |
| PATCH | `/barbers/:id/schedule` ✂️👑 | Actualizar horarios |
| GET | `/barbers/:id/stats` ✂️👑 | Estadísticas |
| GET | `/barbers/:id/appointments?period=day\|week\|month` ✂️👑 | Citas del barbero |
| PATCH | `/barbers/:id/barber-of-the-day` 👑 | Marcar barbero del día |
| DELETE | `/barbers/:id` 👑 | Eliminar |

### appointments
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/appointments` 🔒 | Crear cita (cliente, sujeto a trust score) |
| GET | `/appointments` 👑 | Listar citas |
| GET | `/appointments/:id` 🔒 | Obtener cita |
| GET | `/appointments/available-slots?barber&date` | Slots disponibles |
| GET | `/appointments/wait-time` | Tiempo de espera actual |
| PATCH | `/appointments/:id/status` ✂️👑 | Cambiar estado |
| PATCH | `/appointments/:id/cancel` 🔒 | Cancelar (cliente) |
| PATCH | `/appointments/:id/confirm` 🔒 | Confirmar asistencia (doble check) |
| PATCH | `/appointments/:id/reschedule` 🔒 | Reprogramar |

### services
`GET /services`, `GET /services/featured`, `GET /services/:id` · `POST /services` 👑, `PATCH /services/:id` 👑, `PATCH /services/:id/featured` 👑, `DELETE /services/:id` 👑

### tickets
`POST /tickets` 👑, `GET /tickets` 👑, `GET /tickets?paymentStatus=pendiente` 👑 (cola de cobro), `GET /tickets/:id` 🔒, `GET /tickets/client/:clientId` 🔒, `GET /tickets/:id/receipt` 🔒

### trust-score
`GET /trust-score/:userId` 🔒, `GET /trust-score/:userId/history` 🔒, `PATCH /trust-score/:userId/restore` 👑

### loyalty
`GET /loyalty/coupons`, `POST /loyalty/coupons` 👑, `POST /loyalty/redeem` 🔒, `POST /loyalty/referral/validate`, `GET /loyalty/:userId` 🔒, `GET /loyalty/:userId/history` 🔒

### notifications
`GET /notifications/:userId` 🔒, `PATCH /notifications/:id/read` 🔒, `DELETE /notifications/:id` 🔒, `POST /notifications/send` 👑, `POST /notifications/broadcast` 👑

### waiting-list
`POST /waiting-list` 🔒, `GET /waiting-list` 👑, `GET /waiting-list/client/:clientId` 🔒, `DELETE /waiting-list/:id` 🔒

### reviews
`GET /reviews`, `GET /reviews/barber/:barberId`, `POST /reviews` 🔒, `PATCH /reviews/:id` 🔒, `DELETE /reviews/:id` 🔒

### products
`GET /products`, `GET /products/:id` · `POST /products` 👑, `PATCH /products/:id` 👑, `DELETE /products/:id` 👑

### promotions
`GET /promotions`, `GET /promotions/:id` · `POST /promotions` 👑, `PATCH /promotions/:id` 👑, `DELETE /promotions/:id` 👑, `POST /promotions/notify` 👑

### ai-recommendation
`POST /ai/analyze` 🔒, `GET /ai/recommendations/:userId` 🔒, `POST /ai/share-with-barber` 🔒, `GET /ai/hairstyles`, `POST /ai/hairstyles` 👑, `PATCH /ai/hairstyles/:id` 👑

> El modelo de IA corre **en el dispositivo** (TensorFlow.js). El móvil envía `{ faceType, hairType, selfieUrl? }` y el backend devuelve los cortes compatibles.

### payments
`POST /payments` 👑, `POST /payments/stripe/intent` 👑, `POST /payments/stripe/webhook` (público), `GET /payments` 👑, `GET /payments/:id` 🔒, `GET /payments/client/:clientId` 🔒, `PATCH /payments/:id/status` 👑

> **El cobro (efectivo y tarjeta) es solo del admin/recepción.** El barbero atiende pero no cobra. Al completar una cita reservada o una atención de la fila, el ticket queda **pendiente** y el admin lo cobra; la cola de cobro es `GET /tickets?paymentStatus=pendiente` 👑. Pago con tarjeta vía Stripe (PaymentIntent + webhook).

### orders (compra de productos)
`POST /orders` 🔒, `PATCH /orders/:id/pay-cash` 🔒, `POST /orders/:id/pay-stripe` 🔒, `GET /orders/me` 🔒, `GET /orders/:id` 🔒 · `POST /orders/counter-sale` ✂️👑, `GET /orders` 👑, `PATCH /orders/:id/ready` ✂️👑, `PATCH /orders/:id/picked-up` ✂️👑, `PATCH /orders/:id/cancel` ✂️👑 · `POST /orders/stripe/webhook` (público)

> Compra de productos para **recoger en el local** (BOPIS, sin envío). Descuenta stock atómicamente al pagar. También venta manual en mostrador.

### queue (fila virtual)
`POST /queue` 🔒, `GET /queue/me` 🔒, `DELETE /queue/:id` 🔒 · `GET /queue` ✂️👑, `PATCH /queue/:id/call` ✂️👑, `PATCH /queue/:id/served` ✂️👑

> El barbero marca **atendido** → genera ticket **pendiente** de cobro (lo cobra el admin). Aviso de turno por push cuando la espera baja a ~10 min.

### contact
`POST /contact` (público), `GET /contact` 👑, `PATCH /contact/:id/read` 👑

> El formulario de contacto notifica a la barbería por correo y a los admins in-app.

### health
`GET /health` (público) — estado del servicio y conexión a la base de datos.

### reports (👑)
`GET /reports/income`, `/appointments`, `/clients`, `/barbers`, `/peak-hours`, `/services` (query `?period=daily|weekly|monthly`) · `GET /reports/export/pdf`, `/reports/export/excel`

### admin (👑)
`GET /admin/dashboard`, `PATCH /admin/users/:id/block`, `PATCH /admin/users/:id/unblock`, `PATCH /admin/users/:id/role`

### barbershop-config
`GET /config`, `GET /config/map`, `GET /config/wait-time` · `PATCH /config` 👑, `PATCH /config/holidays` 👑

### uploads
`POST /uploads/image` 🔒 — `multipart/form-data`, campo `file` (imagen ≤ 5 MB), query opcional `?folder=`. Devuelve `{ url, publicId }`.

### chat (REST + WebSocket)

REST: `POST /chat/conversations` 🔒, `GET /chat/conversations/:userId` 🔒, `GET /chat/conversations/:conversationId/messages` 🔒, `POST /chat/messages` 🔒, `PATCH /chat/messages/:id/read` 🔒

WebSocket (Socket.io), namespace **`/chat`**, autenticado por JWT en el handshake:

```js
const socket = io("http://localhost:3000/chat", { auth: { token: accessToken } });
socket.emit("joinConversation", { conversationId });
socket.emit("sendMessage", { conversation, type: "text", content });
socket.on("newMessage", (msg) => { /* ... */ });
```

El emisor se toma del token, no del payload.

## Lógica de negocio destacada

- **Trust score:** no asistir resta 30 pts y suma un strike; 3 strikes bloquean la cuenta; score < 40 restringe reservas 15 días. Un cron cada 30 min cancela citas no confirmadas a tiempo.
- **Al completar una cita:** se genera ticket, se suman puntos de fidelidad y trust score, y se notifica al cliente.
- **Al cancelar una cita:** se penaliza el trust score y se avisa al primero de la lista de espera que coincida.
- **Fidelización:** niveles bronce/plata/oro/platino, bono de primera cita, servicio gratis cada 10 visitas, código de referido.

## Arquitectura

- Modular (un módulo por dominio, bajo `src/modules/`).
- DTOs con `class-validator` en todos los endpoints.
- Schemas Mongoose con `timestamps: true` y **soft delete** (`isActive: false`).
- Guards globales (`JwtAuthGuard`, `RolesGuard`, `ThrottlerGuard`), interceptor de respuesta y filtro de excepciones globales.

## Scripts

| Comando | Acción |
|---|---|
| `pnpm start:dev` | Desarrollo con watch |
| `pnpm build` | Compilar |
| `pnpm start:prod` | Ejecutar build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## Documentación adicional

En la carpeta [`docs/`](./docs) hay guías detalladas por área:

| Documento | Contenido |
|---|---|
| `PAYMENTS.md` / `PAYMENTS-FRONTEND.md` | Flujo de pagos (efectivo, Stripe, reembolso) y su consumo desde el front |
| `ORDERS.md` | Compra de productos (carrito, pago, recoger en local) |
| `QUEUE.md` | Fila virtual (turnos, cobro por el admin) |
| `WALK-IN.md` | Atención directa sin reserva |
| `NOTIFICATIONS.md` | Notificaciones: tipos, disparadores y destinatarios por rol |
| `SCHEDULER.md` | Tareas programadas (recordatorios, expiración de turnos) |
| `HEALTH.md`, `AUDIT-LOG.md`, `GALLERY.md`, `PRODUCTS.md` | Health check, auditoría, galería, productos |

`FRONTEND_PROMPT.md` (raíz) documenta el contrato completo de la API para el equipo de frontend.

## Subir a GitHub

El repositorio ya está creado en GitHub. Para publicar el código por primera vez:

```bash
git add .
git commit -m "Backend inicial de Urban Blade"
git branch -M main
git remote add origin https://github.com/MiguelM07w/urban-blade-backend.git
git push -u origin main
```

> El `.env` (con tus secretos) y `node_modules` **no se suben**: están en `.gitignore`. El archivo `.env.example` sí se incluye como plantilla.
