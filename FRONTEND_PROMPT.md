# Prompt para generar el frontend móvil — Urban Blade

> Copia este archivo completo como contexto para un asistente de IA (o úsalo como guía de desarrollo). Describe la app móvil que consume el backend de Urban Blade. **El backend ya existe y está terminado**; este prompt define únicamente el cliente.

---

## Rol

Eres un desarrollador frontend senior especializado en **React Native con Expo**. Vas a construir la aplicación móvil de la barbería **Urban Blade**, que consume una API REST + WebSocket ya existente (NestJS).

## Stack técnico del frontend

- **Framework:** React Native + **Expo** (SDK 54.0.34 (la version de expo 54.0.34 que esta en le proyecto), managed workflow)
- **Lenguaje:** TypeScript estricto
- **Navegación:** Expo Router (o React Navigation) con navegación por roles
- **Estado del servidor:** TanStack Query (React Query) para fetching/caché
- **Estado global de sesión:** Zustand (o Context) para auth
- **HTTP:** Axios con interceptores (token + refresh automático)
- **Tiempo real:** `socket.io-client` para el chat
- **Almacenamiento seguro:** `expo-secure-store` para los tokens
- **Push:** `expo-notifications` (registrar token y enviarlo al backend)
- **IA on-device:** TensorFlow.js (`@tensorflow/tfjs`, `@tensorflow/tfjs-react-native`) — el modelo de detección de rostro/cabello corre en el dispositivo
- **Imágenes:** `expo-image-picker` + subida al endpoint de uploads
- **Formularios:** React Hook Form + validación (zod)
- **UI:** define un sistema de diseño coherente (paleta de barbería: tonos oscuros, dorados/ámbar de acento). Componentes reutilizables.

## Contrato de la API (respétalo exactamente)

### Base URL

```
http://localhost:3000/api
```

Configúrala como variable de entorno (`EXPO_PUBLIC_API_URL`).

### Formato de respuesta

**Toda** respuesta viene envuelta así. El cliente debe desempaquetar `data`:

```ts
interface ApiResponse<T> {
  success: boolean;
  data: T;          // el payload real
  message: string;
  statusCode: number;
  timestamp: string;
}
```

En error: `success: false`, `data: null`, y `message` con el detalle (mostrarlo al usuario).

### Autenticación

- Login/registro devuelven:

```ts
interface AuthResult {
  accessToken: string;   // vida 15 min
  refreshToken: string;  // vida 7 días
  user: { id: string; name: string; email: string; role: Role; avatar?: string };
}
```

- Enviar en cada request protegido: `Authorization: Bearer <accessToken>`.
- **Refresh automático:** ante un 401, llamar `POST /auth/refresh` con `{ refreshToken }`, guardar los nuevos tokens y reintentar la request original una sola vez. Si el refresh falla, cerrar sesión.
- Guardar tokens en `expo-secure-store`, nunca en AsyncStorage plano.

### Roles

```ts
type Role = "client" | "barber" | "admin";
```

La navegación y las pantallas disponibles dependen del rol del usuario autenticado.

## Enums del dominio (usar exactamente estos valores)

```ts
type HairType = "liso" | "ondulado" | "rizado" | "muy_rizado";
type FaceType = "ovalado" | "redondo" | "cuadrado" | "rectangular" | "diamante" | "corazon";
type AppointmentStatus = "pendiente" | "confirmada" | "completada" | "cancelada" | "no_asistio";
type ServiceCategory = "corte" | "barba" | "combo" | "tratamiento" | "otro";
type LoyaltyLevel = "bronce" | "plata" | "oro" | "platino";
type NotificationType =
  | "recordatorio_cita" | "confirmacion_reserva" | "cancelacion_cita"
  | "ticket_completado" | "lista_de_espera" | "promocion"
  | "recordatorio_corte" | "doble_check" | "alerta_trust_score"
  | "nuevo_estilo" | "nuevo_mensaje";
type DayOfWeek = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";
```

## Endpoints principales (todos bajo `/api`)

- **Auth:** `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`
- **Usuarios:** `GET/PATCH /users/:id`, `DELETE /users/:id`, `GET /users/:id/history`, `GET /users/:id/favorites`, `POST /users/:id/favorites/:hairstyleId`, `PATCH /users/:id/fcm-token`, `GET /users` (admin, listado)
- **Barberos:** `GET /barbers`, `GET /barbers/:id`, `GET /barbers/barber-of-the-day`, `GET /barbers/:id/portfolio`, `GET /barbers/:id/schedule`, `GET /barbers/:id/appointments?period=day|week|month`, `GET /barbers/:id/stats`
- **Citas:** `POST /appointments`, `GET /appointments/available-slots?barber=&date=&service=`, `GET /appointments/quote?service=`, `GET /appointments/wait-time`, `PATCH /appointments/:id/cancel`, `/confirm`, `/reschedule`; barbero: `PATCH /appointments/:id/status`
- **Servicios:** `GET /services`, `GET /services/featured`, `GET /services/:id`
- **Tickets:** `GET /tickets/client/:clientId`, `GET /tickets/:id/receipt`
- **Trust score:** `GET /trust-score/:userId`, `GET /trust-score/:userId/history`
- **Fidelización:** `GET /loyalty/:userId`, `GET /loyalty/:userId/history`, `GET /loyalty/coupons`, `POST /loyalty/redeem`, `POST /loyalty/referral/validate`
- **Notificaciones:** `GET /notifications/:userId`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`
- **Lista de espera:** `POST /waiting-list`, `GET /waiting-list/client/:clientId`, `DELETE /waiting-list/:id`
- **Reseñas:** `GET /reviews`, `GET /reviews/barber/:barberId`, `POST /reviews`, `PATCH /reviews/:id`, `DELETE /reviews/:id`
- **Productos:** `GET /products`, `GET /products/:id`
- **Promociones:** `GET /promotions`, `GET /promotions/:id`
- **IA:** `POST /ai/analyze` → `{ faceType, hairType, selfieUrl? }` devuelve cortes compatibles; `GET /ai/hairstyles`; `GET /ai/recommendations/:userId`; `POST /ai/share-with-barber` → `{ barber, hairstyle }`
- **Pagos:** `POST /payments` (efectivo, **solo admin**), `POST /payments/stripe/intent` (tarjeta, **solo admin**), `GET /payments/client/:clientId`, `GET /payments/:id` · admin: `GET /payments`, `PATCH /payments/:id/status` (reembolso)
- **Tickets:** `GET /tickets/client/:clientId`, `GET /tickets/:id/receipt` · admin: `GET /tickets`, **`GET /tickets?paymentStatus=pendiente`** (cola de cobro)
- **Config barbería:** `GET /config`, `GET /config/map`, `GET /config/wait-time`
- **Contacto:** `POST /contact` (público) · admin: `GET /contact`, `PATCH /contact/:id/read`
- **Fila virtual (walk-in):** `POST /queue`, `GET /queue/me`, `DELETE /queue/:id` · staff: `GET /queue`, `PATCH /queue/:id/call`, `PATCH /queue/:id/served`
- **Galería:** `GET /gallery?type=&faceType=&hairType=&category=&barber=&trending=` (público)
- **Uploads:** `POST /uploads/image` (`multipart/form-data`, campo `file`) → `{ url, publicId }`
- **Chat REST:** `POST /chat/conversations`, `GET /chat/conversations/:userId`, `GET /chat/conversations/:conversationId/messages`, `POST /chat/messages`, `PATCH /chat/messages/:id/read`

### Chat en tiempo real (WebSocket)

Namespace `/chat`, autenticado por JWT en el handshake:

```ts
import { io } from "socket.io-client";
// Usa el host base SIN el prefijo /api (el namespace es /chat). Deriva la URL
// del mismo origen que EXPO_PUBLIC_API_URL quitando el sufijo "/api".
const socket = io(`${WS_BASE_URL}/chat`, { auth: { token: accessToken }, transports: ["websocket"] });

socket.emit("joinConversation", { conversationId });
socket.emit("sendMessage", { conversation: conversationId, type: "text", content });
// El emisor lo determina el servidor desde el token; NO envíes senderId.
socket.on("newMessage", (msg) => { /* añadir al hilo */ });
```

Si el token es inválido, el servidor desconecta el socket. Reautenticar tras un refresh.

## Formas de datos por endpoint (request / response)

> Reglas generales:
> - Todo **response** viene dentro de `ApiResponse<T>`; lo que se muestra abajo es el `data`.
> - `?` = campo **opcional** en el request. El resto son **obligatorios**.
> - Los IDs son `ObjectId` de Mongo en formato string (24 hex). Las entidades se devuelven con **`_id`** (no `id`) y traen un campo interno `__v` de Mongoose que puedes ignorar. **Excepción:** el objeto `user` dentro de la respuesta de auth usa `id`.
> - Las horas son string `"HH:mm"` (24h). Las fechas se envían como ISO (`"2026-07-15"` o ISO completo); en las respuestas vienen como ISO string.
> - El backend valida con `class-validator` y **rechaza campos no declarados** (`forbidNonWhitelisted`): no envíes propiedades extra.
> - Los `PATCH` de actualización aceptan un **subconjunto** de los campos del create (todos opcionales), salvo que se indique lo contrario.
> - **Paginación:** los listados de admin `GET /users` y `GET /appointments` aceptan `?page=&limit=` (default `page=1`, `limit=20`, máx `100`) y devuelven `{ items: T[]; total: number; page: number; limit: number }` en `data` (no un array plano). El resto de listados (`GET /services`, `/barbers`, `/products`, etc.) devuelven un **array** directo.

### Auth

```ts
// POST /auth/register  (body)
{ name: string; email: string; password: string; /* min 6 */ phone?: string }
// POST /auth/login  (body)
{ email: string; password: string }
// POST /auth/google  (body)  — idToken de Google Sign-In
{ idToken: string }
// POST /auth/refresh  (body)
{ refreshToken: string }
// POST /auth/forgot-password (body) → { email }   → data: { resetToken: string | null }
//   El backend envía el enlace de reseteo por EMAIL. Respuesta siempre genérica (no revela si el email existe).
//   - Con SMTP configurado (producción): `resetToken` viene `null` (el token viaja por correo, no se expone).
//   - Sin SMTP (desarrollo): `resetToken` viene en la respuesta como respaldo para poder probar el flujo.
//   El usuario abre el enlace del correo (deep link con ?token=...) y completa el reseteo:
// POST /auth/reset-password (body) → { token, newPassword }   (token = el del enlace/correo)

// Respuesta de register/login/google/refresh (data):
{
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: Role; avatar?: string };
}
```

### Users

```ts
// PATCH /users/:id  (body) — actualizar perfil. NO se puede cambiar email/password/role por aquí.
{ name?: string; phone?: string; avatar?: string; hairType?: HairType; faceType?: FaceType }
// PATCH /users/:id/fcm-token  (body)
{ fcmToken: string }

// User (respuesta):
{
  _id: string; name: string; email: string; phone?: string; avatar?: string;
  hairType?: HairType; faceType?: FaceType; favoriteStyles: string[]; // ids de Hairstyle (o poblados en /favorites)
  authProvider: "email" | "google" | "apple"; role: Role;
  isActive: boolean; isBlocked: boolean; blockedUntil: string | null;
  fcmToken?: string; createdAt: string; updatedAt: string;
}
// `password` y `hashedRefreshToken` NUNCA se devuelven (son select:false en el backend).
```

### Appointments

```ts
// POST /appointments  (body) — solo cliente. endTime se calcula solo desde la duración del servicio.
{
  barber: string;      // id
  service: string;     // id
  date: string;        // ISO date
  startTime: string;   // "HH:mm"
  isRecurring?: boolean;
  recurringType?: "semanal" | "quincenal" | "mensual";
  notes?: string;
  styleSelected?: string; // id de Hairstyle
}
// PATCH /appointments/:id/status  (body) — solo barbero
{ status: "confirmada" | "completada" | "cancelada" | "no_asistio"; cancelReason?: string }
// PATCH /appointments/:id/cancel  (body) — solo cliente
{ cancelReason?: string }
// PATCH /appointments/:id/confirm  — sin body (doble check)
// PATCH /appointments/:id/reschedule  (body) — solo cliente
{ date: string; startTime: string }
// GET /appointments/available-slots?barber=<id>&date=<ISO>&service=<id>  → data: string[]  (p. ej. ["09:00","09:30",...])
//   `service` es OPCIONAL pero MUY recomendado: si lo envías, cada slot reserva el bloque
//   completo de la duración de ese servicio, así un servicio de 120 min solo ofrece horas
//   donde cabe entero (p. ej. si cierra a 18:00, el último inicio será 16:00) y respeta el
//   descanso del barbero. Si lo omites, se usan bloques de 30 min (comportamiento anterior).
// GET /appointments/wait-time  → data: { estimatedWaitMinutes: number }
// GET /appointments/quote?service=<id>&coupon=<CODE>  (auth) — precio con promoción + cupón aplicados.
//   `coupon` es OPCIONAL. El cliente se toma del token (para "primera cita", promos ya usadas y cupón). → data:
//   {
//     basePrice: number;      // precio del servicio sin descuentos
//     discount: number;       // dinero descontado TOTAL (promo + cupón)
//     finalPrice: number;     // basePrice - discount (lo que se cobrará en el ticket)
//     promotion: { id, title, type, discountValue, scope } | null,     // promo aplicada (automática)
//     coupon: { id, code, discountType, discountValue, discount } | null, // cupón aplicado (si es válido)
//     couponError: string | null   // motivo si el cupón enviado NO aplica (ej. "El cupón ha expirado")
//   }
//   Promo y cupón se ACUMULAN: el cupón se calcula sobre el precio ya con promo. Nunca negativo.
//   Si el cupón no aplica: coupon=null, couponError con el motivo, y finalPrice mantiene solo la promo.

// Appointment (respuesta):
{
  _id: string; client: string; barber: string; service: string; // ids (o poblados en algunos endpoints)
  date: string; startTime: string; endTime: string;
  status: AppointmentStatus; cancelledBy: "client" | "barber" | "system" | null; cancelReason: string | null;
  isRecurring: boolean; recurringType: string | null; confirmationDeadline: string;
  confirmedByClient: boolean; estimatedWaitTime: number; notes: string; styleSelected: string | null;
  createdAt: string; updatedAt: string;
}
```

### Services

```ts
// POST /services (admin) | PATCH /services/:id (admin, campos opcionales)
{
  name: string; description?: string; price: number; /* ≥0 */ duration: number; /* min 1, en minutos */
  category: ServiceCategory; image?: string; isMonthlyFeatured?: boolean;
}
// Service (respuesta): { _id, name, description, price, duration, category, image?, isActive, isMonthlyFeatured, createdAt, updatedAt }
```

### Barbers

```ts
// POST /barbers (admin)
{
  user: string; // id de un User existente
  specialty?: string[]; experience?: number; bio?: string;
  schedule?: Array<{ dayOfWeek: DayOfWeek; startTime: "HH:mm"; endTime: "HH:mm"; isAvailable?: boolean }>;
}
// PATCH /barbers/:id  → mismos campos opcionales, MENOS `user`.
// PATCH /barbers/:id/schedule  (body) → { schedule: Array<{ dayOfWeek, startTime, endTime, isAvailable? }> }
// POST /barbers/:id/portfolio  (body) → { imageUrl: string /* URL de Cloudinary */ }   (añade una foto)
// DELETE /barbers/:id/portfolio  (body) → { imageUrl: string }   (elimina esa foto del portafolio; ownership)
// PATCH /barbers/:id/barber-of-the-day (body) → { isBarberOfTheDay: boolean }

// Barber (respuesta): { _id, user (poblado: {name,avatar,email}), specialty, experience, bio,
//   portfolio: string[], schedule: [...], rating, totalReviews, isBarberOfTheDay, isActive, createdAt, updatedAt }
// GET /barbers/:id/stats → { total, completadas, canceladas, noAsistio }
```

### Reviews

```ts
// POST /reviews (cliente) — solo si la cita está "completada" y es suya; una por cita
{ appointment: string; rating: number; /* 1..5 */ comment?: string; photos?: string[] /* URLs */ }
// PATCH /reviews/:id (autor) → { rating?, comment?, photos? }
```

### Loyalty

```ts
// POST /loyalty/redeem (cliente) → { code: string }
// POST /loyalty/referral/validate → { referralCode: string }  → data: { valid: boolean; referrerId: string | null }
// POST /loyalty/coupons (admin) → { code, description?, discountType, discountValue, minVisitsRequired?, expiresAt, maxUses? }
//   discountType: "porcentaje" | "monto_fijo" | "servicio_gratis"

// Loyalty (respuesta): { _id, user, points, level: LoyaltyLevel, totalVisits, freeServicesEarned,
//   claimedLevelBenefits: LoyaltyLevel[], history: [{ date, action, pointsChanged, description }],
//   referralCode, referredBy, totalReferrals }
```

### Waiting-list

```ts
// POST /waiting-list (cliente)
{ barber?: string; /* opcional = cualquiera */ service: string; preferredDate: string;
  preferredTimeRange?: { start: "HH:mm"; end: "HH:mm" } }
// WaitingList (respuesta): { _id, client, barber|null, service, preferredDate, preferredTimeRange,
//   status: "esperando"|"notificado"|"reservado"|"expirado", notifiedAt|null, expiresAt|null, createdAt }
```

### AI-recommendation

```ts
// POST /ai/analyze (cliente) — el móvil ya detectó face/hair on-device
{ faceType: FaceType; hairType: HairType; selfieUrl?: string }
//   → data: { recommendations: Hairstyle[]; historyId: string }
// POST /ai/share-with-barber (cliente) → { barber: string; hairstyle: string }
//   → data: { shared: boolean; conversationId: string }   ← úsalo para abrir el chat
// POST /ai/hairstyles (admin) → { name, description?, faceTypes?: FaceType[], hairTypes?: HairType[],
//   images?: string[], overlayImage?: string, category: HairstyleCategory, isTrending? }

// Hairstyle (respuesta): { _id, name, description, faceTypes, hairTypes, images, overlayImage,
//   category: "clasico"|"moderno"|"fade"|"texturizado"|"otro", isActive, isTrending, createdAt, updatedAt }
```

### Products / Promotions

```ts
// POST /products (admin) → { name, description?, price, stock?, image?, brand?, category }
//   category: "shampoo" | "cera" | "aceite" | "crema" | "otro"
// POST /promotions (admin) → { title, description?, image?, type, discountValue?, startDate, endDate,
//                              targetAudience?, scope?, category?, services? }
//   type: "descuento" | "servicio_gratis" | "combo"
//     - "descuento": `discountValue` es un PORCENTAJE (0-100) que se resta del precio del servicio.
//     - "servicio_gratis": el precio final del servicio pasa a 0.
//     - "combo": publicitaria, no aplica descuento directo al precio de un servicio.
//   targetAudience: "todos" | "nivel_oro" | "nivel_platino" | "nuevos_clientes"   (a QUIÉN se notifica)
//   scope: "todos" | "categoria" | "servicios" | "primera_cita"   (a QUÉ aplica el descuento en el precio)
//     - "categoria": requiere `category` (ServiceCategory: "corte"|"barba"|"combo"|"tratamiento"|"otro")
//     - "servicios": requiere `services: string[]` (ids de servicios concretos)
//     - "primera_cita": solo aplica si el cliente NO tiene ninguna cita previa (de cualquier estado)
//     - "todos": aplica a cualquier servicio
// POST /promotions/notify (admin) → { promotionId: string }
```

> **`targetAudience` vs `scope` — no confundir:** `targetAudience` decide **a quién se le manda la notificación** push de la promo; `scope` decide **a qué servicios se les aplica el descuento** en el precio. Son independientes. Ej.: una promo con `targetAudience: "todos"` y `scope: "primera_cita"` se anuncia a todos, pero el descuento solo baja el precio en la primera cita del cliente.

### Payments

```ts
// POST /payments (barbero/admin) — pago en EFECTIVO; monto y cliente se toman del ticket
{ ticket: string; method?: "efectivo"; notes?: string }
// POST /payments/stripe/intent (auth) — pago con TARJETA; → { clientSecret, paymentId, amount, currency }
{ ticket: string }
// PATCH /payments/:id/status (admin) → { status: "pendiente" | "pagado" | "reembolsado" }  (ver sección Pagos)
```

### Chat

```ts
// POST /chat/conversations → { participants: string[]; /* ≥2 ids */ appointment?: string }
// POST /chat/messages (REST) | evento WS "sendMessage"
{ conversation: string; type?: "text" | "image"; content?: string; imageUrl?: string /* si type=image */ }
// Message (respuesta): { _id, conversation, sender, content, type, imageUrl|null, isRead, createdAt }
```

### Notifications / Config

```ts
// POST /notifications/send (admin) → { user, title, body, type: NotificationType, data?: object }
// POST /notifications/broadcast (admin) → { title, body, type, data? }
// PATCH /config (admin) → subconjunto de { name, address, phone, email, coordinates: {lat,lng},
//   googleMapsUrl, wazeUrl, logo, coverImage, openingHours: [...], socialMedia: {...},
//   maxAppointmentsPerSlot, slotDuration, cancellationWindowHours, isOpen }
// PATCH /config/holidays (admin) → { holidays: Array<{ date: string; description?: string }> }
```

### Uploads

```ts
// POST /uploads/image  — multipart/form-data, campo "file" (imagen ≤ 5MB: jpeg/png/webp/gif)
// query opcional: ?folder=avatars
//   → data: { url: string; publicId: string }
```
## Incluye una pagina principal donde este que es Urban Blade, quienes somos, servicios que ofrecemos y un footer con nuestras redes sociales

## Flujos y pantallas por rol

### Cliente (rol `client`) — experiencia principal

1. **Onboarding / Auth:** splash, login, registro, login con Google, recuperar contraseña.
2. **Home:** barbero del día, corte del mes (`/services/featured`), promociones activas, acceso rápido a reservar.
3. **Reservar cita (flujo guiado):**
   - Elegir servicio → elegir barbero → elegir fecha → ver `available-slots` (pásale `service=<id>` para que los horarios reflejen la duración real) → confirmar.
   - Mostrar aviso si el trust score restringe la reserva.
4. **Mis citas:** próximas y pasadas; acciones confirmar (doble check) / cancelar / reprogramar según estado.
5. **Recomendador de IA:**
   - Tomar selfie → el modelo TensorFlow.js **on-device** detecta `faceType` y `hairType`.
   - Enviar `POST /ai/analyze` y mostrar los cortes recomendados (con overlay 2D si aplica).
   - Guardar favorito o **compartir con el barbero** (`/ai/share-with-barber`, abre chat).
6. **Chat:** lista de conversaciones y hilo en tiempo real con el barbero.
7. **Fidelización:** puntos, nivel, historial, cupones, código de referido para compartir.
8. **Trust score:** puntaje actual e historial (explicar cómo mejorarlo).
9. **Perfil:** editar datos, `hairType`/`faceType`, avatar (subir a uploads), favoritos, historial de cortes, tickets/recibos, notificaciones.
10. **Ubicación:** `GET /config/map` con mapa y enlaces a Google Maps / Waze.

### Barbero (rol `barber`)

- Agenda del día/semana/mes (`/barbers/:id/appointments`).
- Cambiar estado de una cita (`confirmada` / `completada` / `no_asistio` / `cancelada`).
- Ver estadísticas propias, gestionar portafolio y horarios.
- Chat con clientes.

### Admin (rol `admin`)

- Dashboard (`/admin/dashboard`) con métricas.
- Gestión de usuarios (bloquear/desbloquear/cambiar rol), barberos, servicios, productos, promociones, cupones, config de la barbería.
- Reportes (con opción de exportar PDF/Excel).

## Requisitos técnicos transversales

1. **Capa de API tipada:** un cliente Axios central con interceptores (auth + refresh + desempaquetado de `ApiResponse`). Tipar todas las entidades.
2. **React Query:** `queryKeys` consistentes, invalidación tras mutaciones (p. ej. tras reservar, invalidar citas y slots).
3. **Manejo de errores:** mostrar `message` del backend en toasts/alertas legibles.
4. **Push notifications:** pedir permisos, registrar el token de Expo y enviarlo con `PATCH /users/:id/fcm-token`; manejar taps que naveguen al recurso (usar el `data` de la notificación, p. ej. `appointmentId`, `conversationId`).
5. **Estados de carga y vacío:** skeletons y empty states en todas las listas.
6. **Formato de fechas/horas:** las citas usan `date` (fecha) + `startTime`/`endTime` en `HH:mm`.
7. **Accesibilidad y responsividad:** soportar distintos tamaños de pantalla.
8. **Tema:** claro/oscuro coherente con la identidad de la barbería.

## Entregables

1. Estructura del proyecto Expo con navegación por roles.
2. Capa de API + hooks de React Query por dominio.
3. Store de autenticación con persistencia segura y refresh automático.
4. Pantallas del **flujo de cliente** completas (prioridad 1).
5. Integración de chat en tiempo real.
6. Integración del recomendador de IA on-device.
7. Registro de push notifications.
8. Pantallas de barbero y admin (prioridad 2).

## Instrucciones importantes

- Usa TypeScript estricto; tipa las respuestas de la API con los enums de arriba.
- No hardcodees la URL ni secretos: usa variables de entorno de Expo (`EXPO_PUBLIC_*`).
- Respeta el envoltorio `ApiResponse` en **todas** las llamadas.
- Implementa el refresh de token de forma transparente (el usuario no debe notar el vencimiento del access token).
- El modelo de IA corre **en el dispositivo**; el backend solo recibe `{ faceType, hairType }` ya detectados.
- Empieza por el flujo del cliente (auth → home → reservar → mis citas → perfil), que es el núcleo del producto.
- Cabe señalar que los estilos que generes esten de forma independiente creando una carpeta css para los estilos.
- Los estilos de cada rol sera globales solo para el fondo y la tipografia (osea 3 estilos globales por los 3 roles)

## Estado actual del backend (a tener en cuenta)

- **Push notifications aún no se envían de verdad.** El backend integra Firebase Cloud Messaging, pero mientras no se configuren las credenciales de Firebase, los push se registran en log en lugar de enviarse (los cron jobs de recordatorios funcionan, pero no llega la notificación al dispositivo). **Aun así, implementa el registro del token FCM desde ya** (`PATCH /users/:id/fcm-token`): en cuanto se configure Firebase, los push empezarán a llegar sin cambios en el frontend. Diseña la app para recibirlos, aunque en desarrollo no lleguen todavía.
- **El backend no trae tests automatizados.** Se verificó manualmente. Si el frontend asume algún comportamiento no documentado aquí, confírmalo contra la API real (Swagger en `/api/docs`) antes de darlo por hecho.

## Datos de prueba (seed)

El backend incluye un script de seed que puebla datos base para desarrollo. Ejecuta en el proyecto backend:

```bash
pnpm seed
```

Esto crea la config de la barbería, servicios, hairstyles, productos, promociones, barberos y usuarios de prueba. Credenciales para probar los tres roles:

| Rol | Email | Password |
|---|---|---|
| Admin | `admin@urbanblade.com` | `Password123` |
| Barbero | `barber@urbanblade.com` | `Password123` |
| Cliente | `client@urbanblade.com` | `Password123` |

Con estos datos ya hay servicios que reservar, barberos con horario, y estilos para el recomendador — suficiente para desarrollar el flujo de cliente end-to-end sin depender de credenciales externas (Google/Cloudinary/Firebase).

Realiza este proyecto por fases por ejemplo primero crear la estructura necesario e instaladar la librerias o dependencias necesarias y despues comenzar modulo por modulo.

## Subida de imágenes (importante)

**El backend NO recibe archivos en los endpoints de crear/editar entidades.** Esos endpoints (crear servicio, editar perfil, subir foto al portafolio, crear reseña, etc.) esperan la **URL** de la imagen como un simple `string`, no el archivo. La subida del archivo se hace en un endpoint **aparte** (`POST /uploads/image`, que lo envía a Cloudinary). Por eso el flujo siempre es de **dos pasos**:

**Paso 1 — subir el archivo a Cloudinary:**

```
POST /api/uploads/image
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
Body: file = <archivo de imagen>        (query opcional: ?folder=services|avatars|portfolio)
```

Restricciones: imagen `jpeg | png | webp | gif`, tamaño **≤ 5 MB**. Respuesta (`data`):

```ts
{ url: string; publicId: string }
```

**Paso 2 — crear/editar la entidad usando esa `url`** en el campo de imagen correspondiente:

```jsonc
// Ejemplo: crear un servicio con imagen
POST /api/services
{ "name": "Corte clásico", "price": 12, "duration": 30, "category": "corte",
  "image": "https://res.cloudinary.com/.../foo.jpg" }   // ← la url del paso 1
```

### Ejemplo en React Native / Expo

```ts
import * as ImagePicker from "expo-image-picker";

async function uploadImage(accessToken: string, folder = "services"): Promise<string> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
  if (result.canceled) throw new Error("cancelado");
  const asset = result.assets[0];

  const form = new FormData();
  // En React Native, el archivo se adjunta como { uri, name, type }
  form.append("file", {
    uri: asset.uri,
    name: asset.fileName ?? "image.jpg",
    type: asset.mimeType ?? "image/jpeg",
  } as any);

  const res = await fetch(`${EXPO_PUBLIC_API_URL}/uploads/image?folder=${folder}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }, // NO fijes Content-Type: FormData pone el boundary solo
    body: form,
  });
  const json = await res.json();       // { success, data: { url, publicId }, ... }
  return json.data.url;                // usa esta url en el paso 2
}
```

> Nota: para la subida usa `fetch` con `FormData` (o Axios sin fijar `Content-Type` manualmente). No reutilices el cliente Axios que fuerza `application/json` para esta llamada.

### Campos que guardan una URL de imagen (destino del paso 2)

| Entidad | Campo | Endpoint del paso 2 |
|---|---|---|
| Servicio | `image` | `POST /services`, `PATCH /services/:id` |
| Usuario (avatar) | `avatar` | `PATCH /users/:id` |
| Barbero (portafolio) | `imageUrl` | `POST /barbers/:id/portfolio` |
| Reseña (fotos) | `photos: string[]` | `POST /reviews` |
| Producto | `image` | `POST /products`, `PATCH /products/:id` |
| Promoción | `image` | `POST /promotions`, `PATCH /promotions/:id` |
| Hairstyle | `images: string[]`, `overlayImage` | `POST /ai/hairstyles`, `PATCH /ai/hairstyles/:id` |
| Config barbería | `logo`, `coverImage` | `PATCH /config` |
| Chat (imagen) | `imageUrl` (con `type: "image"`) | `POST /chat/messages` |

Patrón recomendado para el frontend: un hook `useImageUpload()` que haga el paso 1 y devuelva la `url`, y luego pásala al formulario de la entidad. Muestra un preview local mientras sube, y el estado de carga del botón hasta que llegue la `url`.

## Fidelización (puntos y notificaciones)

### Endpoints

```ts
// GET /loyalty/:userId  (auth) — ficha de fidelización del usuario
//   → data: {
//       _id, user, points, level: LoyaltyLevel, totalVisits, freeServicesEarned,
//       history: [{ date, action, pointsChanged, description }],
//       referralCode, referredBy, totalReferrals, createdAt, updatedAt
//     }
// GET /loyalty/:userId/history  (auth) → data: Array<{ date, action, pointsChanged, description }>
// GET /loyalty/coupons  (público) → data: Coupon[]   (cupones activos y vigentes)
// POST /loyalty/redeem  (auth) → body { code: string }   (canjea un cupón)
// POST /loyalty/referral/validate → body { referralCode: string } → data { valid, referrerId }
```

### Niveles (según `points`, acumulativos y sin tope)

`bronce` 0–199 · `plata` 200–499 · `oro` 500–999 · `platino` 1000+

### Beneficio por nivel (servicios gratis de bono, una sola vez)

Al **alcanzar** un nivel, el backend otorga automáticamente un bono de **servicios gratis** que se **suma a `freeServicesEarned`** (el mismo contador que se canjea con `POST /loyalty/redeem-free-service` cuando el usuario quiera):

| Nivel | Bono al alcanzarlo |
|---|---|
| bronce | — |
| plata | — |
| **oro** (500+) | **+1 servicio gratis** |
| **platino** (1000+) | **+2 servicios gratis** |

Reglas:
- **Una sola vez por nivel:** el bono de oro se da una vez, el de platino una vez. Aunque el usuario siga sumando puntos, no se repite (el backend lo registra en `claimedLevelBenefits`).
- **Automático:** ocurre solo al ganar puntos/completar cita; no hay botón de "reclamar nivel". El usuario simplemente verá que su `freeServicesEarned` sube.
- **Se acumulan con los de visitas:** estos bonos de nivel se suman al servicio gratis de "cada 10 visitas". Todo va al mismo contador `freeServicesEarned`.
- **El usuario los usa cuando quiera:** no se aplican solos a una cita; se canjean con `POST /loyalty/redeem-free-service` (ver abajo).
- Si un usuario que ya era oro/platino (de antes de esta función) gana un punto, recibirá su bono retroactivamente la primera vez (nunca lo había recibido). Un salto directo de plata a platino otorga oro + platino (3 en total).

La ficha (`GET /loyalty/:userId`) ahora incluye `claimedLevelBenefits: LoyaltyLevel[]` (niveles cuyo bono ya se otorgó) — úsalo si quieres mostrar un check de "beneficio de nivel ya obtenido".

### Cómo se ganan puntos

| Acción | Puntos |
|---|---|
| Cita completada | +20 |
| Primera cita (bono único) | +50 extra |
| Reseña completada | +10 |
| Referido exitoso | +30 |
| Cada 10 visitas | 1 servicio gratis |

### Notificación de puntos (al completar una cita)

Cuando el barbero marca una cita como `completada`, el cliente recibe **dos** notificaciones:
1. `ticket_completado` — con los datos del ticket.
2. `promocion` — con los puntos ganados y el progreso.

La notificación de puntos incluye una **barra de progreso que avanza de 20 en 20 hasta 100** (indicador visual del avance por cita; al llegar a 100 se reinicia). Su `data` trae:

```ts
{
  pointsEarned: 20;
  totalPoints: number;      // puntos acumulados reales (para el nivel)
  cycleProgress: number;    // 20 | 40 | 60 | 80 | 100  ← úsalo para la barra
  rewardCycle: 100;
  level: LoyaltyLevel;
  totalVisits: number;
  freeServicesEarned: number;
  appointmentId: string;
}
```

En el frontend: pinta una **barra de progreso** con `cycleProgress / rewardCycle` (p. ej. `40/100`). Ojo con la distinción:
- `cycleProgress` (0–100) = **indicador visual** de avance por cita, se reinicia cada ciclo.
- `totalPoints` = **puntos reales acumulados**, sin tope, y es lo que determina el `level`.

Muéstralos como dos cosas distintas: la barra "hacia tu próxima meta" (cycleProgress) y el total/nivel (totalPoints/level). El **servicio gratis** real se otorga cada 10 visitas (`freeServicesEarned`), independiente de la barra.

## Chat: iniciar conversación desde un botón

El chat funciona entre **cualquier par de usuarios**, sin importar su rol (cliente↔barbero, admin↔barbero, etc.). Una conversación es solo un array de 2 participantes; el backend valida por **pertenencia**, no por rol. Casos de uso típicos:
- Un **cliente** toca "Enviar mensaje" en el perfil de un barbero para preguntarle una duda.
- Un **admin** le escribe a un barbero para consultarle algo.

### Regla clave

El chat opera sobre **usuarios (`User`)**, no sobre perfiles de barbero. Cuando muestres un barbero (que es un documento `Barber`), su usuario está en el campo **`barber.user`** (poblado trae `{ _id, name, avatar, email }`). Para chatear con él usa **`barber.user._id`**, NO el `barber._id`.

### Flujo del botón "Enviar mensaje"

```ts
// 1) Crear (o reutilizar) la conversación con el otro usuario.
//    createConversation es idempotente: si ya existe una entre esos 2, la devuelve.
POST /chat/conversations
{ participants: [miUserId, otroUserId] }        // p. ej. [clienteId, barber.user._id]
//   → data: { _id: conversationId, participants: [...], lastMessage, lastMessageAt, ... }

// 2) Abrir la pantalla de chat con ese conversationId y conectarse al WebSocket.
socket.emit("joinConversation", { conversationId });

// 3) Enviar mensajes (por WS en tiempo real, o por REST como fallback).
socket.emit("sendMessage", { conversation: conversationId, type: "text", content: "Hola, tengo una duda" });
// o REST:  POST /chat/messages  { conversation, type: "text", content }
```

Endpoints implicados:
- `POST /chat/conversations` → `{ participants: string[]; appointment?: string }` (crea/reutiliza)
- `GET /chat/conversations/:userId` → lista de conversaciones del usuario (para la bandeja)
- `GET /chat/conversations/:conversationId/messages` → historial del hilo
- `POST /chat/messages` → enviar mensaje por REST
- `PATCH /chat/messages/:id/read` → marcar como leído
- WebSocket `/chat`: eventos `joinConversation`, `sendMessage`; recibe `newMessage`

Recomendación de UI: un solo botón **"Enviar mensaje"** en el perfil del barbero sirve tanto para iniciar como para retomar la conversación (gracias a la idempotencia). No necesitas un botón aparte de "añadir". Tras crear la conversación, navega directo al hilo. Opcionalmente, puedes pasar `appointment` al crear la conversación para vincularla al contexto de una cita.

### Notificación por cada mensaje (solo si el destinatario NO está viendo el chat)

Cada vez que se envía un mensaje —da igual si por **REST** (`POST /chat/messages`) o por **WebSocket** (`sendMessage`)— el backend crea una notificación (persistida + push, tipo `nuevo_mensaje`) para **el otro participante** (el destinatario, no el emisor), **excepto** si ese destinatario está **activo en esa conversación** en ese momento. Esto aplica a todos los canales: cliente↔barbero, barbero↔admin, etc.

**Qué significa "activo en la conversación":** el backend considera activo a un usuario que tiene un socket **unido a la sala de esa conversación** por WebSocket, es decir, que emitió `joinConversation` con ese `conversationId` y **no** ha hecho `leaveConversation` ni se ha desconectado. En la práctica: **está con la pantalla del chat abierta**. A ese usuario le llega el mensaje en vivo por `newMessage`, así que el backend **omite** la notificación para no duplicar el aviso. Si el destinatario tiene la app cerrada, está en otra pantalla, o salió de la conversación, **sí** recibe la notificación.

> **Implicación para el frontend (importante):** para que el backend sepa que estás "dentro" del chat y no te mande notificación redundante, **debes emitir `joinConversation` al abrir la pantalla del hilo y `leaveConversation` (o desconectar el socket) al salir**. Si nunca haces `join`, el backend te tratará como inactivo y recibirás notificación de cada mensaje aunque tengas el chat abierto.

Distingue dos cosas que llegan por vías distintas:
- **`newMessage` (WebSocket):** el mensaje en tiempo real, para pintarlo en el hilo cuando estás **dentro de la conversación** (unido a la sala).
- **Notificación `nuevo_mensaje`:** el aviso persistido (campanita) + push, que llega **solo cuando NO estás en esa conversación**. Úsala para el badge de no leídos y para el push con la app en background.

```ts
// La notificación de un mensaje tiene esta forma (dentro de ApiResponse, en la bandeja):
{
  _id: string; user: string;               // destinatario
  title: "Nuevo mensaje";
  body: string;                            // preview del texto (o "📷 Imagen"), truncado a ~120 chars
  type: "nuevo_mensaje";
  data: { conversationId: string; senderId: string };  // navega al hilo; senderId para resolver nombre/avatar
  isRead: boolean; sentAt: string; createdAt: string; updatedAt: string;
}
```

Manejo recomendado en el frontend:
1. **Marca presencia con `join`/`leave`:** al **entrar** al hilo, `socket.emit("joinConversation", { conversationId })`; al **salir** (unmount de la pantalla o navegar fuera), `socket.emit("leaveConversation", { conversationId })`. Esto es lo que evita que el backend te mande la notificación de mensajes que ya estás viendo en vivo. No hace falta lógica de "ignorar toast" en primer plano: si estás en el hilo, la notificación **no se genera**.
2. **Badge de mensajes no leídos:** consulta `GET /notifications/:userId` (tu propio `userId`) y cuenta las de `type === "nuevo_mensaje"` con `isRead === false`. También puedes apoyarte en `conversation.lastMessageAt` de `GET /chat/conversations/:userId` para ordenar la bandeja.
3. **Tap en la notificación / push:** usa `data.conversationId` para navegar directo al hilo (`joinConversation` + cargar mensajes). Marca la notificación como leída (`PATCH /notifications/:id/read`) al abrir el chat.
4. **Push (cuando Firebase esté activo):** el tap del push trae el mismo `data.conversationId`; enruta al hilo. Recuerda tener registrado el token FCM del usuario (`PATCH /users/:id/fcm-token`), igual para clientes, barberos y admin.

> Notas:
> - La detección de presencia es **por WebSocket**: si el destinatario recibe mensajes solo por REST sin conectar el socket ni hacer `join`, el backend lo tratará como inactivo y le notificará. Para el comportamiento correcto, la pantalla del chat debe mantener el socket conectado y unido a la sala mientras esté abierta.
> - La notificación es **best-effort** en el backend; si fallara, el mensaje **igual se envía y persiste**. La fuente de verdad del hilo es `GET /chat/conversations/:conversationId/messages` + el evento `newMessage`, no la notificación.

## Reseñas: valorar al barbero por cita

El cliente puede **calificar el servicio** (1–5 estrellas + comentario opcional + fotos opcionales) **una vez por cita**, y esas reseñas se **consumen** en el perfil del barbero para mostrar su valoración.

### Reglas del backend (respétalas en la UI)

- Solo el **cliente dueño de la cita** puede reseñarla (si no, `403`).
- La cita debe estar en estado **`completada`** (si no, `400 "Solo puedes reseñar citas completadas"`).
- **Una sola reseña por cita** (si ya existe, `400 "Esta cita ya tiene una reseña"`).
- `rating` es entero **1 a 5**; `comment` y `photos` son opcionales.
- Al crear una reseña, el backend **recalcula automáticamente** el `rating` y `totalReviews` del barbero, y suma **+10 puntos** de fidelidad al cliente. No tienes que hacer nada extra para eso.

### Flujo del cliente (crear reseña)

```ts
// Botón "Calificar" disponible en cada cita COMPLETADA que aún no tenga reseña.
POST /reviews   (auth, rol client)
{ appointment: string; rating: number; /* 1..5 */ comment?: string; photos?: string[] /* URLs, ver subida de imágenes */ }
//   → data: Review

// Editar la propia reseña (solo el autor):
PATCH /reviews/:id   { rating?, comment?, photos? }
// Eliminar (autor o admin):
DELETE /reviews/:id
```

> Para saber qué citas mostrar con botón "Calificar": lista las citas del cliente (`GET /users/:id/history`), filtra `status === "completada"`, y oculta el botón en las que ya reseñó (puedes cruzar contra las reseñas o, más simple, deshabilitarlo si el POST devuelve el error de "ya tiene reseña").

### Consumir reseñas (mostrarlas)

```ts
// Reseñas de un barbero — para el perfil del barbero (público):
GET /reviews/barber/:barberId
//   → data: Review[]   (solo las visibles, más recientes primero, con `client` poblado {name, avatar})

// Todas las reseñas (listado general, p. ej. sección de opiniones):
GET /reviews   → data: Review[]

// Review (forma de respuesta):
{
  _id: string; client: string | { name, avatar }; barber: string; appointment: string;
  rating: number; comment: string; photos: string[]; isVisible: boolean;
  createdAt: string; updatedAt: string;
}
```

El **rating promedio** y el **total de reseñas** del barbero NO se calculan en el frontend: vienen ya listos en el propio documento del barbero (`barber.rating`, `barber.totalReviews`), actualizados por el backend cada vez que se crea/edita/elimina una reseña. Úsalos directo para las estrellas del perfil.

Recomendación de UI:
- **Perfil del barbero:** cabecera con `rating` promedio (estrellas) + `totalReviews`, y debajo la lista de `GET /reviews/barber/:barberId` (estrellas, comentario, fotos y nombre/avatar del cliente).
- **Detalle de cita completada:** botón "Calificar servicio" → modal con selector de estrellas (1–5), campo de comentario y adjuntar fotos (usando el flujo de subida de imágenes). Tras enviar, refresca el perfil del barbero (React Query: invalida `["reviews", barberId]` y `["barber", barberId]`).

## Notificaciones al barbero (reserva / cancelación / reprogramación)

Cuando un **cliente** reserva, cancela o reprograma una cita, el **barbero** de esa cita recibe ahora una notificación automática (persistida y, cuando Firebase esté configurado, push). Esto le permite enterarse sin tener que refrescar su agenda manualmente. No hay un endpoint nuevo que llamar para *generar* estas notificaciones: las crea el backend solo, como efecto secundario de las acciones del cliente que ya consumes (`POST /appointments`, `PATCH /appointments/:id/cancel`, `PATCH /appointments/:id/reschedule`). El frontend solo tiene que **leerlas y mostrarlas** en la bandeja del barbero.

### Qué recibe el barbero

| Acción del cliente | `type` de la notificación | Título | `data` |
|---|---|---|---|
| Reserva una cita (`POST /appointments`) | `confirmacion_reserva` | "Nueva reserva" | `{ appointmentId }` |
| Cancela su cita (`PATCH /appointments/:id/cancel`) | `cancelacion_cita` | "Un cliente canceló su cita" | `{ appointmentId }` |
| Reprograma su cita (`PATCH /appointments/:id/reschedule`) | `confirmacion_reserva` | "Un cliente reprogramó su cita" | `{ appointmentId }` |

> El destinatario es el **`User`** dueño del perfil de barbero (el backend resuelve `barber.user` internamente; tú no envías nada). Las notificaciones al cliente que ya existían (confirmación del barbero, ticket, puntos, etc.) **no cambian**.

### Cómo se consumen (mismos endpoints de notificaciones de siempre)

El barbero lee su bandeja con los endpoints de notificaciones estándar, usando **su propio `userId`** (el `user.id` de la sesión, rol `barber`):

```ts
// Bandeja del barbero — lista sus notificaciones (más recientes primero).
GET /notifications/:userId          (auth)   → data: Notification[]

// Marcar una como leída (p. ej. al abrirla).
PATCH /notifications/:id/read       (auth)   → data: Notification

// Eliminar una.
DELETE /notifications/:id           (auth)

// Notification (forma de respuesta):
{
  _id: string; user: string; title: string; body: string;
  type: NotificationType;               // aquí: "confirmacion_reserva" | "cancelacion_cita"
  data: { appointmentId: string };      // payload para navegar al detalle de la cita
  isRead: boolean; sentAt: string; createdAt: string; updatedAt: string;
}
```

## ⚠️ Ownership de notificaciones (seguridad — CAMBIO)

Los endpoints de lectura/escritura de notificaciones ahora **validan pertenencia**.
Antes cualquier usuario autenticado podía leer/borrar las notificaciones de otro
(era un fallo). Ahora:

- Un usuario solo puede **listar / leer / borrar sus propias** notificaciones.
- El **admin** puede acceder a las de cualquiera.
- Acceder a las de otro devuelve **`403 "No puedes acceder a notificaciones ajenas"`**.

```ts
GET    /notifications/:userId   // :userId DEBE ser el del usuario autenticado (o ser admin) → si no, 403
PATCH  /notifications/:id/read  // la notif debe ser tuya (o admin) → si no, 403
DELETE /notifications/:id       // la notif debe ser tuya (o admin) → si no, 403
```

**Acción para el front:** en `GET /notifications/:userId`, usa **siempre** el
`userId` del usuario en sesión. No pases el de otro (recibirás 403).

## Quién recibe qué notificación (matriz por rol — CAMBIOS)

Se corrigió el reparto de notificaciones por rol. **Resumen de lo que cambió:**

- ❌ **Antes:** una promoción/broadcast llegaba a **todos** (incluidos admin y
  barberos). ✅ **Ahora:** las promociones y difusiones van **solo a clientes**.
- ✅ **Nuevo:** el **barbero** recibe aviso cuando un **cliente con app** entra a su
  **fila virtual**.
- ✅ **Nuevo:** los **admins** reciben aviso cuando se **completa un corte** de la
  fila virtual, y cuando entra un **mensaje del formulario de contacto** (además
  del correo).

### CLIENTE (con cuenta / app)
Recibe lo suyo (sin cambios): confirmación de reserva, cancelación, recordatorios
(24 h/1 h), **ticket de su servicio**, **puntos de fidelidad / servicio gratis**,
turno en la fila, lista de espera, recomendación IA, promociones, chat.
> Los **invitados sin cuenta** (walk-in / mostrador) **no reciben nada** (no tienen
> app): solo se les genera ticket/pago.

### BARBERO
| Evento | `type` | Título |
|---|---|---|
| Cliente reserva / reprograma su cita | `confirmacion_reserva` | "Nueva reserva" / "Un cliente reprogramó su cita" |
| Cliente cancela su cita | `cancelacion_cita` | "Un cliente canceló su cita" |
| **Cliente con app entra a su fila virtual** *(nuevo)* | `fila_nuevo_cliente` | "Nuevo cliente en tu fila" |
| Mensaje de chat (admin o cliente) | `nuevo_mensaje` | "Nuevo mensaje" |
| Cancelación de labores que notifica el admin | `cancelacion_cita` | (según el aviso del admin) |

### ADMIN
| Evento | `type` | Título | `data` |
|---|---|---|---|
| **Cita reservada completada, lista para cobro** *(nuevo)* | `aviso_admin` | "Cobro pendiente (cita)" | `{ appointmentId, ticketId, clientId }` |
| **Atención de fila lista para cobro** *(nuevo)* | `aviso_admin` | "Cobro pendiente (fila)" | `{ queueEntryId, ticketId, barberId, clientId, guestName }` |
| **Nuevo mensaje de contacto** *(nuevo)* | `aviso_admin` | "Nuevo mensaje de contacto" | `{ name, email }` |
| Mensaje de chat **de un barbero/empleado** | `nuevo_mensaje` | "Nuevo mensaje" | `{ conversationId, senderId }` |
| **NO** recibe promociones ni difusiones | — | — | — |
| **NO** recibe push de chat de un **cliente** *(cambio)* | — | — | — |

> **Chat → admin (restricción):** al admin **solo** le llega notificación push de
> chat cuando le escribe un **barbero/empleado**. Si le escribe un **cliente**, el
> mensaje **se guarda igual** (y llega en vivo por WebSocket si tiene el chat
> abierto), pero **no** genera notificación push. Para barberos y clientes el chat
> notifica como siempre.

> **Tipos nuevos en el enum:** `"aviso_admin"` (avisos internos al admin) y
> `"fila_nuevo_cliente"` (cliente entró a la fila del barbero). Contémplalos al
> renderizar/enrutar por `type`.

> Estas notificaciones las **genera el backend solo** como efecto de acciones que ya
> consumes (entrar a la fila, completar corte, enviar el formulario de contacto).
> El front solo las **lee y muestra** con los endpoints estándar de notificaciones,
> usando el `userId` de la sesión.

### Flujo recomendado en la app del barbero

1. **Bandeja de notificaciones:** en el layout del rol `barber`, consulta `GET /notifications/:userId` con `userId = user.id` de la sesión. Muestra un badge con el número de `isRead === false`. Refresca al entrar y, si tienes push, al recibir uno.
2. **Tap en la notificación:** usa `data.appointmentId` para navegar al detalle de esa cita en la agenda del barbero (`GET /appointments/:id`). Al abrirla, llama `PATCH /notifications/:id/read`.
3. **Invalidación (React Query):** cuando llegue un push o al hacer pull-to-refresh, invalida `["notifications", userId]` y también la agenda (`["barber-appointments", barberId, period]`) para que la nueva reserva/cambio aparezca sin recargar la app.
4. **Push (cuando Firebase esté activo):** como con el resto de notificaciones, el tap del push trae el mismo `data.appointmentId`; enruta al detalle de la cita. Recuerda registrar el token FCM del barbero igual que el del cliente (`PATCH /users/:id/fcm-token`).

> Nota: estas notificaciones son **best-effort** en el backend — si el envío fallara, la reserva/cancelación/reprogramación del cliente **no se rompe**. Por eso no dependas de la notificación como confirmación de la acción; la fuente de verdad de la cita sigue siendo el propio endpoint de citas y la agenda (`GET /barbers/:id/appointments`).

## Horarios de reserva: duración del servicio y descanso del barbero

El horario que ve el cliente al reservar **no es un rango fijo**: se calcula a partir del **`schedule` del barbero** y de la **duración del servicio elegido**. Dos reglas importantes:

### 1. Pásale siempre el `service` a `available-slots`

```ts
GET /appointments/available-slots?barber=<id>&date=<ISO>&service=<serviceId>
//   → data: string[]   (horas de inicio disponibles, p. ej. ["09:00","09:30","10:00", ...])
```

- **Con `service`:** cada slot reserva el **bloque completo** de `service.duration`. Un servicio de **120 min** solo ofrece inicios donde cabe entero: si el barbero cierra a las 18:00, el último inicio será **16:00** (16:00 + 2h = 18:00), y no ofrecerá 16:30 ni 17:00.
- **Sin `service`:** el backend usa bloques de 30 min (comportamiento heredado). Por eso, si en tu pantalla ves siempre horarios cada 30 min sin importar el servicio, es porque **no estás enviando `service`** — añádelo.
- El **paso entre inicios candidatos sigue siendo 30 min** (rejilla): un servicio de 120 min ofrece `09:00, 09:30, 10:00…`, cada uno reservando sus 2 horas. Esto da más opciones al cliente que saltar de 2 en 2 horas.

> Flujo correcto en la pantalla de reservar: el usuario **elige primero el servicio**, y con ese `serviceId` pides los slots. Si cambia de servicio, **vuelve a pedir** los slots (React Query: incluye `serviceId` en el `queryKey`, p. ej. `["available-slots", barberId, date, serviceId]`).

### 2. Horario y descanso del barbero (varias franjas por día)

El horario de atención sale del **`schedule` del barbero** (`GET /barbers/:id/schedule`), no de la config global. Cada entrada es una **franja**: `{ dayOfWeek, startTime, endTime, isAvailable }`. Un mismo día puede tener **varias franjas**, y el hueco entre ellas es el **descanso** (almuerzo, etc.).

```ts
// Ejemplo: barbero que trabaja 09:00–13:00 y 14:00–18:00 los lunes (descansa 13:00–14:00)
PATCH /barbers/:id/schedule
{
  "schedule": [
    { "dayOfWeek": "lunes", "startTime": "09:00", "endTime": "13:00", "isAvailable": true },
    { "dayOfWeek": "lunes", "startTime": "14:00", "endTime": "18:00", "isAvailable": true }
  ]
}
```

- El backend **excluye automáticamente** el hueco entre franjas: los slots saltan de la mañana a la tarde sin ofrecer nada durante el descanso.
- Un servicio que **no cabría** dentro de una franja sin invadir el descanso **no se ofrece** en esa hora (p. ej. un servicio de 120 min no aparece a las 12:00 si la franja de mañana termina a las 13:00).
- Si el cliente intenta reservar (o reprogramar) a una hora que cae fuera de toda franja o dentro del descanso, el backend responde `400 "La hora solicitada está fuera del horario del barbero o cae en su descanso"`. Muestra ese `message`.

Recomendación de UI para configurar el horario (pantalla de barbero/admin): un editor de franjas por día donde se puedan **añadir varias franjas** al mismo día (botón "＋ añadir tramo"), para modelar el descanso. Al guardar, envía **todas** las franjas del día en el array de `schedule` (el `PATCH` reemplaza el horario completo).

## Barbero: editar su propia información (perfil)

Un barbero es **dos entidades**: su cuenta **`User`** (identidad: nombre, teléfono, avatar) y su perfil profesional **`Barber`** (bio, especialidades, experiencia, portafolio, horario). Editar "su información" toca **dos endpoints distintos**, cada uno con su propio id.

### Regla de seguridad (ownership)

El backend ahora **verifica propiedad**: un barbero (o cualquier no-admin) solo puede editar/eliminar **lo suyo**. Si intenta actuar sobre el `User` o el `Barber` de otra persona, responde `403`:
- `PATCH /users/:id`, `PATCH /users/:id/fcm-token` y `DELETE /users/:id` → solo si `:id` es **su propio** `user.id` (el admin puede sobre cualquiera).
- `PATCH /barbers/:id`, `PATCH /barbers/:id/schedule`, `POST /barbers/:id/portfolio`, `DELETE /barbers/:id/portfolio` → solo si ese perfil de barbero le pertenece (`barber.user._id === su user.id`); el admin, cualquiera.

> `DELETE /users/:id` es **soft delete** (marca la cuenta como inactiva, no la borra). Sirve para "eliminar mi cuenta" desde el perfil; para bloquear/expulsar a otros usa el módulo admin.

### Paso previo: obtener su propio `barber._id`

En la sesión el barbero solo tiene su **`user.id`**, pero para editar el perfil `Barber` necesita el **`barber._id`**. Hay un endpoint dedicado:

```ts
GET /barbers/me/profile        (auth, rol barber/admin)
//   → data: Barber   (su propio perfil, con `user` poblado {_id, name, avatar, email})
//   Guarda `barber._id` (para PATCH de perfil/horario/portafolio) y `barber.user._id` (= tu user.id).
//   Si el usuario no tiene perfil de barbero → 404.
```

Llama esto al entrar a la pantalla de perfil del barbero y cachéalo (React Query: `["barber", "me"]`).

### Qué puede editar y con qué endpoint

| Dato | Entidad | Cómo |
|---|---|---|
| **Foto de perfil (avatar)** | User | Sube a `/uploads/image` → `PATCH /users/:userId` con `{ avatar: url }` |
| **Nombre, teléfono** | User | `PATCH /users/:userId` con `{ name?, phone? }` (el **email NO** se puede cambiar) |
| **Bio, especialidades, experiencia** | Barber | `PATCH /barbers/:barberId` con `{ bio?, specialty?: string[], experience?: number }` |
| **Portafolio (fotos de trabajos)** | Barber | Añadir: sube a `/uploads/image` → `POST /barbers/:barberId/portfolio` con `{ imageUrl: url }`. Eliminar: `DELETE /barbers/:barberId/portfolio` con `{ imageUrl: url }` |
| **Horario / descanso** | Barber | `PATCH /barbers/:barberId/schedule` con `{ schedule: [...] }` (ver sección de horarios) |
| **Token push (FCM)** | User | `PATCH /users/:userId/fcm-token` con `{ fcmToken }` |

```ts
// Ejemplos de body:

// Perfil User (identidad) — usa tu user.id:
PATCH /users/:userId
{ "name": "Carlos Ruiz", "phone": "+50688887777", "avatar": "https://res.cloudinary.com/.../foto.jpg" }

// Perfil Barber (profesional) — usa tu barber._id (de /barbers/me/profile):
PATCH /barbers/:barberId
{ "bio": "10 años haciendo fades", "specialty": ["fade", "barba"], "experience": 10 }

// Añadir foto al portafolio:
POST /barbers/:barberId/portfolio
{ "imageUrl": "https://res.cloudinary.com/.../trabajo.jpg" }

// Eliminar una foto del portafolio (por su URL; la que ya muestras en la galería):
DELETE /barbers/:barberId/portfolio
{ "imageUrl": "https://res.cloudinary.com/.../trabajo.jpg" }
//   → data: Barber (con el `portfolio` ya actualizado). Ownership: solo el dueño o admin.
//   Nota: elimina la URL del array; el archivo en Cloudinary NO se borra (se conserva).
```

### Flujo recomendado en la pantalla "Editar perfil" del barbero

1. Al abrir, `GET /barbers/me/profile` → obtienes `barber._id`, `barber.user._id` (= tu `userId`) y los valores actuales (bio, specialty, experience, portfolio, schedule). El nombre/avatar del User vienen poblados en `barber.user`; si necesitas el User completo (teléfono, etc.), `GET /users/:userId`.
2. Un formulario con dos bloques: **"Cuenta"** (avatar, nombre, teléfono → `PATCH /users/:userId`) y **"Perfil profesional"** (bio, especialidades, experiencia → `PATCH /barbers/:barberId`). El **email** muéstralo de solo lectura.
3. Para avatar y portafolio, usa el flujo de dos pasos de subida de imágenes (sube a `/uploads/image`, luego guarda la `url`).
4. Tras guardar, invalida las queries afectadas (`["barber","me"]`, `["barber", barberId]`, `["user", userId]`). Muestra el `message` del backend en caso de error (p. ej. el `403` si el id no coincide con el suyo).

## Promociones y descuentos en el precio

Hay que distinguir **dos sistemas separados** que antes se confundían:

1. **Notificación de promociones** (`POST /promotions/notify`, admin): solo envía un push publicitario a la audiencia (`targetAudience`). **No cambia precios.**
2. **Descuento real en el precio**: se calcula con **`GET /appointments/quote`** y se **aplica automáticamente al ticket** cuando la cita se completa. Este es el que hace que "20% en la primera cita" se refleje en lo que paga el cliente.

### Cómo mostrar el precio con descuento (flujo de reserva)

En la pantalla de reservar, después de que el cliente elige el **servicio**, pide la cotización:

```ts
GET /appointments/quote?service=<serviceId>      (auth)
//   → data: { basePrice, discount, finalPrice, promotion }
```

- Si `discount > 0`, muestra el **precio tachado** (`basePrice`) junto al **precio final** (`finalPrice`) y una etiqueta con `promotion.title` (p. ej. "Bienvenida −20%").
- Si `promotion` es `null`, muestra solo `basePrice` (no hay promo aplicable).
- El **cliente sale del token**, no lo mandas tú; por eso las promos de `scope: "primera_cita"` se evalúan solas según el historial del usuario autenticado.

> React Query: incluye `serviceId` en el `queryKey` (`["quote", serviceId]`). Vuelve a pedir la cotización si el cliente cambia de servicio.

### Aplicar un CUPÓN en el paso Confirmar (campo opcional)

Además de la promoción automática, el cliente puede introducir un **código de cupón**. Se re-cotiza pasando `coupon`:

```ts
GET /appointments/quote?service=<serviceId>&coupon=<CODE>   (auth)
//   → data: { basePrice, discount, finalPrice, promotion, coupon, couponError }
```

Comportamiento (contrato):
- **Válido:** `coupon = { id, code, discountType, discountValue, discount }` y `couponError = null`. `discount` (del cupón) es el dinero que resta ese cupón; `finalPrice` ya lo incluye. Muestra una etiqueta **"Cupón CODE · −$discount"** además de la de la promoción.
- **Inválido:** `coupon = null` y `couponError` trae el motivo (`"Cupón no encontrado o inactivo"`, `"El cupón ha expirado"`, `"Ya has canjeado este cupón"`, `"El cupón alcanzó su límite de usos"`, `"Necesitas al menos N visitas para este cupón"`). Muéstralo bajo el campo. El `finalPrice` **mantiene solo la promo** (el flujo no se rompe).
- **Acumulación:** promo y cupón **se suman**. El cupón se calcula sobre el precio **ya con promo** (ej.: base 150, promo −10% → 135, cupón −20% → −27, final **108**). Nunca negativo.
- **Tipos de cupón:** `porcentaje` (% sobre el precio-tras-promo), `monto_fijo` ($ fijo), `servicio_gratis` (final 0).
- Botón **Quitar cupón** → vuelve a cotizar sin `coupon`.

Al **confirmar la reserva**, envía `coupon` en el body **solo si el backend confirmó que aplica** (coupon != null en el último quote):

```ts
POST /appointments   { barber, service, date, startTime, ..., coupon?: "CODE" }
//   El backend RE-valida el cupón al reservar. Si es inválido → 400 con el motivo (muestra el message).
//   El cupón NO se consume al reservar: se congela y se marca como usado al COMPLETAR la cita.
```

> El cupón se consume (queda registrado como usado por ese cliente) **al completar la cita**, no al reservar. Si la cita se cancela, el cupón **no se gasta**. Igual que las promos, el descuento definitivo se congela en el ticket al completar.

### Cómo se aplica realmente el descuento

- **El descuento NO se guarda al reservar** (la cita no fija precio). Se calcula y congela **cuando el barbero marca la cita como `completada`**: el backend genera el ticket con `price = finalPrice` (ya descontado) y la notificación de ticket muestra el precio con el descuento.
- Por eso `GET /appointments/quote` es una **estimación en el momento de reservar** (refleja las promos vigentes hoy). El precio definitivo es el del ticket al completar. Si una promo vence entre la reserva y la cita, el ticket usará las promos vigentes en ese momento.

### Reglas del motor de descuento (respétalas en la UI)

- Solo se aplica **una** promoción: la que dé **mayor descuento** al cliente. **No se acumulan.**
- `type: "descuento"` → `discountValue` es **porcentaje** (20 = 20%). `type: "servicio_gratis"` → precio final 0. `type: "combo"` → no descuenta un servicio suelto (es publicitaria).
- Segmentación por `scope`: `todos` (cualquier servicio), `categoria` (los de esa `category`), `servicios` (lista concreta de ids), `primera_cita`.
- El precio final nunca es negativo (topado en 0).

**Uso único por usuario (importante):** cada promoción se aplica **UNA sola vez por cliente**. Cuando una cita con promoción se completa, el backend registra que ese usuario ya usó esa promo, y **futuras reservas del mismo cliente con esa misma promoción ya no reciben el descuento** (aunque la promo siga vigente). Esto vale para todos los `scope`. Por eso el precio de `GET /appointments/quote` es **por-cliente**: dos clientes distintos pueden ver precios distintos para el mismo servicio según lo que cada uno ya haya redimido.

**Qué es "primera cita" (`scope: "primera_cita"`):** aplica solo si el cliente **no tiene NINGUNA cita previa** — de cualquier estado (pendiente, confirmada, completada, cancelada o no_asistió). Consecuencias que debes reflejar en la UI:
- Es, por naturaleza, de un solo uso: en cuanto el cliente tiene su primera reserva, sus siguientes reservas ya **no** califican (aunque la primera no se haya completado todavía).
- Es para clientes **realmente nuevos** que aún no han reservado nunca. Un usuario que ya reservó antes (aunque canceló) no la recibe.
- No confíes en mostrarla "siempre": pide `GET /appointments/quote` y deja que el backend decida; si el cliente ya no califica, `promotion` vendrá `null` y verás el precio completo.

### Crear promociones desde el panel admin (ejemplos)

```jsonc
// 20% en la PRIMERA cita, para todo el mundo:
POST /promotions
{ "title": "Bienvenida", "type": "descuento", "discountValue": 20,
  "scope": "primera_cita", "targetAudience": "todos",
  "startDate": "2026-07-01", "endDate": "2026-12-31" }

// 15% en toda la categoría "corte":
{ "title": "Mes del corte", "type": "descuento", "discountValue": 15,
  "scope": "categoria", "category": "corte",
  "startDate": "...", "endDate": "..." }

// 25% solo en servicios concretos:
{ "title": "Promo combos", "type": "descuento", "discountValue": 25,
  "scope": "servicios", "services": ["<serviceId1>", "<serviceId2>"],
  "startDate": "...", "endDate": "..." }
```

En el formulario de crear promoción (admin): cuando el admin elige `scope`, muestra el campo dependiente — un selector de **categoría** si `scope=categoria`, o un multiselect de **servicios** si `scope=servicios`. Para `todos` y `primera_cita` no se pide nada extra.

## Recibos: desglose de precio (original, descuento, total)

El ticket ahora **congela el desglose de precio** en el momento de emitirse (al completar la cita), para que el recibo lo imprima aunque la promoción cambie o se elimine después. `GET /tickets/:id/receipt` (y `GET /tickets/client/:clientId`) devuelven estos campos:

```ts
// Ticket / recibo (data):
{
  _id: string;
  ticketNumber: string;              // "TB-2026-0001"
  appointment: string;               // id
  client: string | { name, email };  // poblado en /receipt
  barber: string;                    // id
  service: string | { name, price }; // poblado
  serviceDate: string;               // ISO
  completedAt: string;               // ISO

  // --- Desglose de precio (para el recibo) ---
  basePrice: number;                 // precio original del servicio, sin descuento
  discount: number;                  // monto descontado (0 si no hubo promo)
  price: number;                     // precio final cobrado (= basePrice - discount)
  appliedPromotion: {                // promo aplicada, congelada; o null si no hubo
    promotion: string;               // id de la Promotion
    title: string;                   // p. ej. "Bienvenida"
    type: "descuento" | "servicio_gratis" | "combo";
    discountValue: number;           // 20 (%) para descuento
    scope: "todos" | "categoria" | "servicios" | "primera_cita";
  } | null;
  appliedCoupon: {                   // cupón aplicado, congelado; o null si no hubo
    coupon: string;                  // id del Coupon
    code: string;                    // p. ej. "VERANO20"
    discountType: "porcentaje" | "monto_fijo" | "servicio_gratis";
    discountValue: number;           // 20 (%) o el monto fijo
    discount: number;                // dinero efectivamente descontado por el cupón
  } | null;

  paymentMethod: "efectivo";
  paymentStatus: "pendiente" | "pagado";
  hairstyleSelected: string | null;
  createdAt: string;                 // (no hay updatedAt en tickets)
}
// Nota: `discount` (nivel raíz del ticket) es el descuento TOTAL (promoción + cupón).
```

### Cómo imprimir el recibo

```
Servicio                         Corte clásico
Subtotal                                 ₡100
Promoción: Bienvenida (−20%)             −₡20     ← solo si appliedPromotion != null
Cupón: VERANO20 (−10%)                   −₡8      ← solo si appliedCoupon != null
-----------------------------------------------
Total                                     ₡72     ← price
Estado de pago                        Pendiente
```
Pinta la línea de **Cupón** igual que la de Promoción, usando `appliedCoupon.code` y `appliedCoupon.discount`, solo si `appliedCoupon != null`. Ambas líneas pueden aparecer a la vez (promo + cupón).

- Muestra la línea de **Subtotal** con `basePrice` y la de **Total** con `price` siempre.
- Muestra la línea de **descuento** (`−discount`) y el nombre de la promo (`appliedPromotion.title`) **solo si `discount > 0`** (o `appliedPromotion != null`). Si no hubo promo, `basePrice === price` y no pintas línea de descuento.
- Para promos de porcentaje puedes mostrar `appliedPromotion.discountValue` como "−20%"; el monto real ya lo tienes en `discount`.

## Admin: gestión de usuarios, roles y creación de staff

Toda la gestión de usuarios por parte del admin va por el módulo **`/admin`** (rutas 👑, requieren rol `admin`). **No uses `PATCH /users/:id` para cambiar `role`** — ese endpoint es para el perfil propio y **rechaza `role`** (`400 "property role should not exist"`).

### 1. Cambiar el rol de un usuario

```ts
PATCH /admin/users/:id/role        (admin)
{ "role": "client" | "barber" | "admin" }
//   → data: User (con el nuevo role)
```

**Efecto automático sobre el perfil de barbero (importante):**
- Al cambiar el rol a **`barber`**, el backend **crea (o reactiva) su documento `Barber`** automáticamente. El usuario **aparece de inmediato en `GET /barbers`**, puede recibir citas y chatear. No tienes que hacer un `POST /barbers` aparte.
- Al cambiar el rol **fuera de `barber`** (a `client`/`admin`), el backend **desactiva** su perfil `Barber` (deja de aparecer en `/barbers`).
- Es idempotente: ascender → degradar → volver a ascender **reactiva** el mismo perfil, no duplica.

> El perfil `Barber` recién creado sale **vacío** (sin bio, especialidades, horario ni portafolio). El barbero luego lo completa desde "editar perfil" (ver sección "Barbero: editar su propia información"), o el admin con `PATCH /barbers/:barberId`. Hasta que no tenga **horario** (`schedule`), no ofrecerá slots de reserva.

### 2. Crear un usuario con rol (staff) — solo admin

El autorregistro público (`POST /users`) **siempre crea `client`** e **ignora/rechaza `role`** (por seguridad: evita que cualquiera se cree como admin). Para dar de alta staff con rol, usa el endpoint admin:

```ts
POST /admin/users                  (admin)
{ "name": string, "email": string, "password": string /* min 6 */,
  "role": "client" | "barber" | "admin", "phone"?: string }
//   → data: User
//   Si role === "barber", crea también su perfil Barber (aparece en /barbers).
```

A diferencia de `/auth/register`, este **no inicia sesión** ni fuerza rol `client`: crea la cuenta con el rol indicado y el admin sigue con su propia sesión.

### 3. Bloquear / desbloquear

```ts
PATCH /admin/users/:id/block       (admin)  { "blockedUntil"?: string /* ISO; si se omite = permanente */ }
PATCH /admin/users/:id/unblock     (admin)
//   → data: User
```

### Recomendación de UI (pantalla admin de usuarios)

- Lista con `GET /users?page=&limit=` (devuelve `{ items, total, page, limit }`).
- Acción "Cambiar rol" → `PATCH /admin/users/:id/role`. Tras éxito, si el nuevo rol es `barber`, invalida también `["barbers"]` para que aparezca en la lista de barberos; si dejó de serlo, igual (para que desaparezca).
- Botón "Crear usuario" → formulario con `role` → `POST /admin/users`. Si eligió `barber`, avísale que el perfil se crea vacío y que debe completar horario/bio.
- Bloquear/desbloquear → los endpoints de arriba.

> **Autorregistro del cliente (app):** el registro normal de un cliente sigue siendo `POST /auth/register` (devuelve tokens e inicia sesión). `POST /users` es un alta alternativa que también crea solo clientes, pero sin login. Para la app usa `POST /auth/register`.

## Fidelización: canjes (cupón, código de referido y servicio gratis)

Hay **tres cosas distintas** que se "canjean" y cada una tiene **su propio endpoint**. Confundirlas es la causa del `404` al intentar canjear (usar `/redeem` con un código de referido devuelve `404 "Cupón no encontrado o inactivo"`, porque `/redeem` es solo para cupones). Úsalas así:

### A) Cupón de descuento (código creado por el admin)

Son códigos tipo `VERANO20` que el admin crea con `POST /loyalty/coupons`. **Solo estos** se canjean con `/redeem`.

```ts
POST /loyalty/redeem            (auth)   { "code": "VERANO20" }
//   → data: Coupon (con el uso registrado)
//   Errores: 404 "Cupón no encontrado o inactivo" (no existe / inactivo),
//            400 "El cupón ha expirado" | "Ya has canjeado este cupón" |
//                "El cupón alcanzó su límite de usos" |
//                "Necesitas al menos N visitas para este cupón"
```

> Si tu sistema **no tiene cupones creados**, cualquier código dará `404` aquí. Un cupón NO es lo mismo que un código de referido.

### B) Código de referido (el que un usuario comparte con otro)

Cada usuario tiene su propio **`referralCode`** (lo ves en su ficha: `GET /loyalty/:userId` → `data.referralCode`). Cuando **otro** usuario lo introduce, se **aplica** con un endpoint dedicado (NO con `/redeem`):

```ts
// Validar (opcional, para dar feedback antes de aplicar) — público:
POST /loyalty/referral/validate  { "referralCode": "8576FA40" }
//   → data: { valid: boolean, referrerId: string | null }

// APLICAR el referido — este es el que faltaba y el que debes usar para "canjear":
POST /loyalty/referral/apply     (auth)   { "referralCode": "8576FA40" }
//   → data: { referrerId: string, pointsAwarded: 30 }
//   Vincula tu cuenta con quien te refirió y le da +30 pts a esa persona.
//   Errores: 404 "Código de referido no válido",
//            400 "No puedes usar tu propio código de referido",
//            400 "Ya usaste un código de referido antes"  (uso ÚNICO por usuario)
```

Reglas de negocio (respétalas en la UI):
- **Uso único:** un usuario solo puede aplicar **un** código de referido en toda su vida (la 2ª vez → `400`). Deshabilita el campo si `GET /loyalty/:userId` ya trae `referredBy != null`.
- **No puedes usar tu propio código** (→ `400`).
- El que gana los **+30 puntos** es el **referente** (dueño del código), no quien lo introduce.
- Flujo típico: en "Fidelización → Ingresar código de referido", el usuario pega el código de un amigo y llamas `POST /loyalty/referral/apply`. Muestra el `message` del backend en caso de error.

### C) Servicio gratis (cada 10 visitas + bonos de nivel)

El backend acumula `freeServicesEarned` por dos vías, ambas al mismo contador: **+1 por cada 10 citas completadas** y los **bonos de nivel** (+1 al llegar a oro, +2 a platino, una vez cada uno — ver "Beneficio por nivel"). Ese contador **se puede canjear**, bajándolo en 1, **cuando el usuario quiera**:

```ts
POST /loyalty/redeem-free-service   (auth)   // sin body
//   → data: Loyalty (con freeServicesEarned ya decrementado)
//   Error: 400 "No tienes servicios gratis disponibles para canjear"
```

En la UI:
- Lee `GET /loyalty/:userId` → `data.freeServicesEarned`. Si es `> 0`, muestra un banner "Tienes **N** servicios gratis" con botón **Canjear**.
- Al pulsar Canjear → `POST /loyalty/redeem-free-service`. Refresca la ficha (`["loyalty", userId]`); el contador baja en 1.
- El canje es **atómico** en el backend (no hay doble-canje aunque el usuario toque rápido dos veces): el segundo intento sobre el último disponible fallará con `400`.
- Cómo el cliente usa ese servicio gratis en una cita concreta es un flujo aparte (hoy el canje solo consume el contador y queda registrado en el historial de fidelización con acción `servicio_gratis_canjeado`; la aplicación al precio de una cita puntual se coordina en la barbería). Muéstralo como "beneficio disponible/canjeado", no como un descuento automático en el `quote`.

### Resumen de qué endpoint usar

| Quiero… | Endpoint | Body |
|---|---|---|
| Canjear un **cupón** de admin (VERANO20) | `POST /loyalty/redeem` | `{ code }` |
| **Aplicar** el código de **referido** de un amigo | `POST /loyalty/referral/apply` | `{ referralCode }` |
| Solo **validar** un código de referido | `POST /loyalty/referral/validate` | `{ referralCode }` |
| **Canjear** un **servicio gratis** acumulado | `POST /loyalty/redeem-free-service` | *(sin body)* |
| Ver puntos, nivel, referralCode, freeServicesEarned | `GET /loyalty/:userId` | — |

## Contáctanos

Formulario público (sin token) para que cualquier visitante escriba a la barbería. El backend guarda el mensaje y, si hay SMTP + email de barbería configurados, lo envía al correo de la barbería (`config.email`).

```ts
// Enviar mensaje (público, sin auth):
POST /contact
{ name: string /* 2-100 */, email: string /* válido */, message: string /* 5-2000 */, phone?: string }
//   → data: { success: true }   (HTTP 201)
//   Validación (400 con `message` legible para toast):
//     "name must be longer than or equal to 2 characters" | "email must be an email" |
//     "message must be longer than or equal to 5 characters" | ...
```

- Respuesta genérica `{ success: true }`; muestra un toast de éxito. Ante error, muestra el `message` del backend.
- El envío de correo es **best-effort**: aunque falle (o no haya SMTP), el mensaje **se guarda igual** y la respuesta es 201. No dependas del correo para confirmar al usuario.

### Bandeja de mensajes (admin)

```ts
GET /contact                 (admin) → data: ContactMessage[]   (más recientes primero)
PATCH /contact/:id/read      (admin) → data: ContactMessage     (isRead = true)

// ContactMessage: { _id, name, email, phone?, message, isRead, createdAt, updatedAt }
```

En el panel admin: una bandeja que lista `GET /contact`, con badge de no leídos (`isRead === false`), y al abrir un mensaje llama `PATCH /contact/:id/read`. Muestra `name`, `email`, `phone` (si hay) y `message`; ofrece responder por email/teléfono desde el cliente de correo/teléfono del dispositivo.

## Fila virtual (walk-in queue)

Para los clientes que **llegan sin cita**. En lugar de un vago "espérate", el sistema les da una **posición** y una **espera estimada**, y les avisa por push cuando su turno se acerca. Todos los endpoints requieren auth.

### Enums

```ts
type QueueStatus = "esperando" | "llamado" | "atendido" | "cancelado" | "expirado";
```

### Forma de una entrada (`QueueEntryView`)

```ts
{
  id: string;
  client: string | null;        // userId; null si es invitado sin cuenta
  guestName: string | null;     // nombre del invitado (si client es null)
  guestPhone: string | null;
  barber: string | null;        // barbero preferido; null = cualquiera
  service: string;
  status: QueueStatus;
  position: number;             // 1 = siguiente
  estimatedWaitMinutes: number; // minutos estimados hasta ser atendido
  createdAt: string;
}
```

### Flujo del CLIENTE (rol client)

```ts
// Unirse a la fila (a sí mismo): el cliente sale del token, NO envíes `client`.
POST /queue
{ "service": "<serviceId>", "barber": "<barberId>"? }   // barber opcional = cualquiera
//   → data: QueueEntryView (con position y estimatedWaitMinutes)
//   Error: 400 "Ya estás en la fila de espera" (no se permiten 2 entradas activas)

// Ver mi lugar (pantalla "estás en la fila"):
GET /queue/me     → data: QueueEntryView | null    // null si no estás en la fila

// Salir de la fila:
DELETE /queue/:id → data: null
```

UI cliente: tras unirse, pantalla tipo "Eres el #{position}, ~{estimatedWaitMinutes} min con {barbero o 'el primero disponible'}". Refresca `GET /queue/me` periódicamente (p. ej. cada 30-60s) y al recibir push. Botón "Salir de la fila".

### Flujo del STAFF (rol barber/admin)

```ts
// Ver la fila completa (panel):
GET /queue     → data: QueueEntryView[]   // ordenada; trending de posición 1 hacia abajo

// Registrar a otra persona CON cuenta:
POST /queue    { "service": "<id>", "client": "<userId>", "barber": "<id>"? }

// Registrar a un INVITADO sin cuenta (walk-in anónimo):
POST /queue    { "service": "<id>", "guestName": "Juan Pérez", "guestPhone": "+506..."?, "barber": "<id>"? }
//   → data: QueueEntryView con client=null, guestName, guestPhone
//   (solo staff; un cliente no-staff que envíe `client`/`guestName` de otro → 403)

// Llamar al cliente (es su turno) → le llega push "Es tu turno":
PATCH /queue/:id/call     → data: QueueEntryView (status "llamado")

// Marcarlo como atendido (sale de la fila, el resto avanza) — genera un TICKET
// PENDIENTE de cobro (NO cobra aquí; lo cobra el admin después):
PATCH /queue/:id/served   { barberId? }   → data: null
//   - Crea una cita completada + ticket pendiente de pago (reutiliza el flujo
//     del walk-in, pero SIN cobrar). Cliente con cuenta suma puntos/trust y
//     recibe su notificación de ticket; invitado sin cuenta solo genera ticket.
//   - `barberId` (opcional): solo necesario si la entrada NO fijaba barbero
//     ("cualquiera") y quien marca atendido es un ADMIN (sin perfil de barbero).
//     Si lo marca un BARBERO, se usa su propio perfil automáticamente.
//     400 "Debes indicar el barbero que atendió (barberId)..." si falta.
//   - Avisa a los admins (push `aviso_admin`) con `data.ticketId` para la cola
//     de cobro.

// Sacar a alguien de la fila:
DELETE /queue/:id
```

UI staff: lista de la fila con posición, nombre (`client` poblado o `guestName`), servicio y espera; botones **Llamar** y **Atendido** por entrada; formulario para añadir walk-in (con opción "invitado sin cuenta" → `guestName`). Refresca tras cada acción.

### Cobro de una atención de la fila (separación atención / cobro)

El barbero **atiende** pero **no cobra**. Al marcar `served`, el ticket queda
**pendiente** y el **admin/recepción** lo cobra. Flujo:

1. Barbero → `PATCH /queue/:id/served` → ticket pendiente + push al admin
   (`aviso_admin`, `data.ticketId`, `data.guestName`/`data.clientId`).
2. Admin ve la cola: **`GET /tickets?paymentStatus=pendiente`** (lista de tickets
   por cobrar; no dependas solo del push, que es best-effort).
3. Admin cobra ese ticket:
   - Efectivo → `POST /payments { ticket, method: "efectivo" }`
   - Tarjeta → `POST /payments/stripe/intent { ticket }` → PaymentSheet (Stripe
     real de 2 pasos, con formulario) → confirmar por webhook.

> **Guard (cambio):** `POST /payments` y `POST /payments/stripe/intent` ahora son
> **solo `admin`**. Un barbero recibe **`403`** si intenta cobrar. El cobro está
> centralizado en el admin/recepcionista.

### Notas de comportamiento (respétalas en la UI)

- **Motor de espera:** la `estimatedWaitMinutes` considera la fila delante Y las **citas ya agendadas** del barbero (un walk-in espera a que el barbero termine su agenda). Si una cita se marca `no_asistio`/`cancelada`, la espera de la fila **baja sola** en la siguiente consulta.
- **Aviso "tu turno se acerca":** cuando la espera baja a ~10 min, el cliente (con cuenta) recibe un **push** (tipo `recordatorio_cita`, con `data.queueEntryId`). Enruta el tap a su pantalla de fila.
- **Expiración:** si el staff **llama** a un cliente y este **no se presenta en 10 min** (no lo marcan `served`), su entrada pasa a `expirado` y sale de la fila; si tenía cuenta, recibe un push avisándole. Muéstralo como "turno perdido" y ofrece volver a unirse.
- **Invitados** (`client: null`) no reciben push (no tienen cuenta); el staff los llama a viva voz. Muestra `guestName` en la lista.
- **No confundir con citas:** la fila es para walk-ins del momento (hoy, presencial); las **reservas** siguen siendo `POST /appointments`. Son flujos separados.

## Pagos (efectivo, tarjeta con Stripe, reembolso)

Se paga un **ticket** (generado al completar una cita o una atención de la fila).
El monto y el cliente se toman del ticket. Dos métodos: **efectivo** y **tarjeta**
(Stripe). **El cobro lo hace solo el ADMIN/recepción** (el barbero atiende, no cobra).

```ts
type PaymentMethod = "efectivo" | "stripe";
type PaymentStatus = "pendiente" | "pagado" | "reembolsado";
```

> **Cola de cobro:** `GET /tickets?paymentStatus=pendiente` (admin) lista los
> tickets aún no cobrados (citas completadas y atenciones de fila). Es la fuente
> de verdad de "qué falta cobrar" (no dependas solo del push).

### Efectivo (solo admin)

```ts
POST /payments   (SOLO admin)   { ticket, method?: "efectivo", notes? }
//   → data: Payment (status "pagado"); el ticket queda pagado.
//   400 "Este ticket ya tiene un pago registrado" si ya se pagó.
//   403 si lo intenta un barbero (el cobro es solo del admin).
```

### Tarjeta con Stripe (solo admin)

Flujo de dos pasos con la pasarela. Necesitas `@stripe/stripe-react-native` y la **Publishable Key** de Stripe (`pk_...`) en `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (envuelve la app en `<StripeProvider publishableKey=...>`).

```ts
// 1) Pedir el intento de pago al backend (SOLO admin):
POST /payments/stripe/intent   (SOLO admin)   { ticket: "<ticketId>" }
//   → data: { clientSecret: string; paymentId: string; amount: number; currency: string }
//   400 "Los pagos con tarjeta no están disponibles..." si Stripe no está configurado en el backend
//   400 "Este ticket ya tiene un pago registrado" si ya se pagó
//   403 si lo intenta un barbero o un cliente (el cobro es solo del admin)

// 2) Cobrar la tarjeta en el móvil con el clientSecret (la tarjeta NO pasa por tu backend):
import { useStripe } from "@stripe/stripe-react-native";
const { initPaymentSheet, presentPaymentSheet } = useStripe();
await initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: "Urban Blade" });
const { error } = await presentPaymentSheet();
// si !error → el cobro se hizo. El backend lo confirma solo por webhook (en segundos).
```

> **La fuente de verdad es el estado del pago/ticket, no `presentPaymentSheet`.** Tras un cobro sin error, **refresca** el ticket o `GET /payments/:id` hasta ver `status: "pagado"` (lo marca el webhook de Stripe, que llega en segundos). No des el pago por confirmado solo con la respuesta del sheet.

### Consultar pagos

```ts
GET /payments/client/:clientId  (auth)  → data: Payment[]   // historial del cliente
GET /payments/:id               (auth)  → data: Payment
GET /payments                   (admin) → data: Payment[]   // todos, recientes primero
```

### Reembolso (admin)

```ts
PATCH /payments/:id/status   (admin)   { status: "reembolsado" }
//   → data: Payment (status "reembolsado", paidAt null)
```

Comportamiento a reflejar en la UI:
- **Tarjeta (Stripe):** el backend hace el **reembolso REAL en Stripe** (devuelve el dinero a la tarjeta del cliente).
- **Efectivo:** solo cambia el estado (el reembolso se hace en persona; no hay pasarela).
- En ambos casos el **ticket vuelve a `pendiente`** de pago. El `paymentMethod` del ticket **se conserva** (p. ej. sigue `"tarjeta"`): refleja cómo se cobró originalmente. Para saber si hay que volver a cobrar, guíate por `paymentStatus: "pendiente"`, no por el método.
- Errores: `400 "Este pago ya fue reembolsado"` (doble reembolso), `400` si el pago no estaba `pagado`, `400` si es tarjeta y Stripe no está configurado. Muestra el `message`.

Recomendación de UI:
- **Cliente:** en un ticket **pendiente**, botón "Pagar con tarjeta" (flujo Stripe de arriba). Tras pagar, refresca hasta `pagado`.
- **Staff:** en un ticket pendiente, botón "Cobrar en efectivo" → `POST /payments`.
- **Admin:** lista de pagos con método/estado/monto; botón "Reembolsar" en pagos `pagados` (confirma antes; es irreversible en Stripe). Tras reembolsar, invalida `["payments"]` y el ticket.

### Payment (forma de respuesta)

```ts
{
  _id: string;
  ticket: string | { ticketNumber, price };   // poblado en listados
  client: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  notes: string;
  stripePaymentIntentId: string | null;        // solo pagos con tarjeta
  createdAt: string; updatedAt: string;
}
```

> **Compatibilidad con tickets antiguos:** los tickets emitidos **antes** de esta mejora no tienen `basePrice`/`discount`/`appliedPromotion` (llegarán como `undefined`). Trátalos con defensa: si `basePrice` es `undefined`, usa `price` como subtotal y no muestres línea de descuento. Regla simple: `const subtotal = ticket.basePrice ?? ticket.price; const desc = ticket.discount ?? 0;`.

### ⚠️ Errores frecuentes al integrar pagos (LEER)

Tres fallos reales observados en el front. El backend ya vincula ticket ↔ pago
correctamente; estos son problemas del lado del cliente:

1. **El ticket mostraba "efectivo" con pago de tarjeta** — *era un bug de backend,
   ya corregido:* el ticket no propagaba el método real. Ahora
   `Ticket.paymentMethod` puede ser `"efectivo"` **o `"tarjeta"`** (contempla
   ambos en el recibo). Recordatorio de endpoints: para tarjeta se usa
   `POST /payments/stripe/intent`, **nunca** `POST /payments` (ese es exclusivo
   del staff para efectivo y siempre crea el pago como efectivo).

2. **El ticket sigue "pendiente" aunque el cobro con tarjeta fue exitoso.** El
   ticket **solo** pasa a `pagado` cuando llega el **webhook** de Stripe al
   backend — NO con la respuesta de `presentPaymentSheet`. Si el webhook no está
   configurado (`STRIPE_WEBHOOK_SECRET` + URL pública apuntando a
   `POST /payments/stripe/webhook`), el dinero se cobra pero el ticket nunca se
   actualiza. Tras un cobro sin error, **haz polling** de `GET /payments/:id` (o
   relee el ticket) hasta ver `status: "pagado"` (llega en segundos). La fuente de
   verdad es el estado del pago, no el sheet.

3. **El efectivo también se ve "pendiente".** El backend marca el ticket como
   `pagado` **de inmediato** al hacer `POST /payments`. Si el front lo sigue
   mostrando pendiente, es que **no está releyendo el ticket** tras el cobro:
   invalida la query del ticket (`["tickets", id]`) y de `["payments"]` y vuelve
   a pedir el `GET`. No cachees el estado de pago.

> Guía completa de este consumo en **`docs/PAYMENTS-FRONTEND.md`**.