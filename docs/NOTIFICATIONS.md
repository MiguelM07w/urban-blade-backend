# Notificaciones — estado actual (Urban Blade API)

Documento del **estado actual** del módulo de notificaciones: qué existe, cómo se
comporta, qué endpoints expone y desde dónde se disparan. Es una **foto de lo
implementado hoy** (no una propuesta). Al final se listan, solo a título
informativo, los huecos observables en el código para futuras decisiones.

---

## 1. Qué es y cómo funciona

Una **notificación** es un registro persistente por usuario (se guarda en Mongo) y,
en paralelo, un **push** a su dispositivo vía **Firebase Cloud Messaging (FCM)**.

El flujo canónico está en `NotificationsService.createForUser(...)`:

1. **Persiste** la notificación en la colección `notifications` (siempre, con
   `sentAt = now`).
2. **Envía el push** con `pushToDevice(...)` — *best-effort*: si falla FCM o el
   usuario no tiene `fcmToken`, **NO** se lanza error; la notificación ya quedó
   guardada y la operación de negocio que la originó continúa.

> **Regla de oro:** un fallo de push nunca tumba la operación de negocio (reservar,
> completar cita, pagar, etc.). El push es un extra; la fuente de verdad es el
> registro en base de datos, que el front lee con `GET /notifications/:userId`.

### Push (FCM) — comportamiento

- Se resuelve el `fcmToken` del usuario (`User.fcmToken`). Si **no tiene token**,
  no se envía push (pero la notificación sí se guarda).
- FCM solo admite `data` con **valores string**: el servicio serializa cada valor
  del payload a string (objetos → JSON) antes de enviar (`stringifyData`).
- Si **Firebase no está configurado** en el backend, el envío se registra en log y
  se omite (degradación elegante, gestionada por `FirebaseService`). El resto sigue
  funcionando.

### Registro del token del dispositivo (requisito para recibir push)

El push **solo llega** si el usuario registró su `fcmToken`. Eso se hace desde el
módulo **users**:

```ts
PATCH /users/:id/fcm-token   (auth)   { fcmToken: string }
```

El móvil debe llamarlo tras obtener el token de FCM (y al refrescarlo). Sin esto,
las notificaciones se guardan pero nunca hay push.

---

## 2. Modelo de datos (forma de una notificación)

Colección `notifications` (`@Schema({ timestamps: true })`):

```ts
{
  _id: string;
  user: string;                 // ObjectId del destinatario (indexado)
  title: string;
  body: string;
  type: NotificationType;       // enum (ver abajo), indexado
  data: Record<string, unknown>;// payload libre por tipo (ej. { appointmentId })
  isRead: boolean;              // default false
  sentAt: string;               // cuándo se envió el push
  createdAt: string;            // timestamps
  updatedAt: string;
}
```

- `data` **no tiene esquema fijo**: cada tipo transporta lo suyo (p. ej.
  `appointmentId`, `ticketId`, `orderId`, puntos de fidelidad, etc.). El front lo
  usa para **enrutar** a la pantalla correspondiente.

### Tipos de notificación (`NotificationType`)

```ts
type NotificationType =
  | "recordatorio_cita"       // recordatorio de cita próxima (scheduler + cola)
  | "confirmacion_reserva"    // reserva creada/confirmada/reprogramada
  | "cancelacion_cita"        // cita cancelada (cliente o barbero)
  | "ticket_completado"       // se emitió el ticket al completar la cita
  | "lista_de_espera"         // se liberó un cupo de la lista de espera
  | "promocion"               // promos, puntos de fidelidad, orden lista, etc.
  | "recordatorio_corte"      // (declarado; sin disparador aún — ver §6)
  | "doble_check"             // (declarado; sin disparador aún — ver §6)
  | "alerta_trust_score"      // aviso por baja de trust score (no-show/cancelación)
  | "nuevo_estilo"            // recomendación de nuevo estilo (IA)
  | "nuevo_mensaje"           // mensaje nuevo de chat
  | "aviso_admin"            // avisos internos al admin (contacto, corte de fila)
  | "fila_nuevo_cliente";    // cliente con app entró a la fila virtual del barbero
```

---

## 3. Endpoints que consume el frontend

Base: `/api/notifications`. Todos requieren autenticación (`ApiBearerAuth`).

```ts
// Listar las notificaciones de un usuario (recientes primero):
GET /notifications/:userId
//   → data: Notification[]   (orden desc por createdAt)
//   403 "No puedes acceder a notificaciones ajenas"  (si :userId no es el tuyo y no eres admin)

// Marcar una como leída:
PATCH /notifications/:id/read
//   → data: Notification (isRead: true)
//   403 "No puedes acceder a notificaciones ajenas"  (si la notif no es tuya y no eres admin)
//   404 "Notificación no encontrada"

// Eliminar una notificación:
DELETE /notifications/:id
//   → data: null
//   403 "No puedes acceder a notificaciones ajenas"  (si la notif no es tuya y no eres admin)
//   404 "Notificación no encontrada"
```

> **Ownership (seguridad):** estos tres endpoints validan pertenencia. Un usuario
> solo puede listar/leer/borrar **sus propias** notificaciones; el **admin** puede
> acceder a las de cualquiera. Si intentas acceder a las de otro usuario, responde
> `403`. (El front debe usar siempre el `userId` del usuario autenticado en el
> `GET`.)

### Endpoints solo ADMIN

```ts
// Enviar una notificación manual a un usuario concreto:
POST /notifications/send        (admin)
{ user: "<userId>", title, body, type: NotificationType, data?: object }
//   → data: Notification (persistida + push best-effort)

// Difundir a TODOS los usuarios activos:
POST /notifications/broadcast   (admin)
{ title, body, type: NotificationType, data?: object }
//   → data: { sent: number }   // nº de notificaciones creadas
```

> **Nota importante sobre `broadcast`:** hoy **inserta en lote** un registro por
> cada usuario activo (`insertMany`), pero **NO envía push masivo** — el multicast
> FCM está pendiente (ver §6). Es decir, el broadcast se ve en la lista del usuario
> (`GET /notifications/:userId`) pero **no** dispara push en este momento.

### Comportamiento esperado en el front

- **Badge / campana:** contar las `isRead: false` de `GET /notifications/:userId`.
- **Al abrir una notificación:** `PATCH /notifications/:id/read` y enrutar según
  `type` + `data` (p. ej. `type: "ticket_completado"` + `data.ticketId` → abrir el
  recibo).
- **Push recibido en primer/segundo plano:** el `data` del push llega con **todos
  los valores como string** (por la serialización FCM). Parsea lo que necesites
  (`JSON.parse` en los que eran objetos).
- **Tras leer/eliminar:** refresca la lista (invalida `["notifications", userId]`).

---

## 4. Disparadores automáticos (dónde se generan)

Estas notificaciones las crea el backend solo, vía `createForUser(...)`, desde
otros módulos. **El front no las pide**: llegan solas y aparecen en la lista.

| Evento de negocio | Tipo | Destinatario | Origen (código) |
|---|---|---|---|
| Reserva creada / confirmada | `confirmacion_reserva` | Cliente | `appointments.service` |
| Cliente reserva / cancela / reprograma | `confirmacion_reserva` / `cancelacion_cita` | **Barbero** | `appointments.service` (`notifyBarberById`) |
| Cita cancelada | `cancelacion_cita` | Cliente | `appointments.service` |
| Baja de trust score (no-show/cancelación) | `alerta_trust_score` | Cliente | `appointments.service` |
| Cita completada → ticket emitido | `ticket_completado` | Cliente | `appointments.service` (`data.ticketId`) |
| Puntos de fidelidad / servicio gratis | `promocion` | Cliente | `appointments.service` (al completar) |
| Recordatorio de cita (24 h / 1 h) | `recordatorio_cita` | Cliente | `appointments.service` (`sendReminder`, scheduler) |
| Aviso de turno en la fila virtual | `recordatorio_cita` | Cliente | `queue.service` |
| Se liberó cupo en lista de espera | `lista_de_espera` | Cliente | `waiting-list.service` |
| Nueva promoción dirigida | `promocion` | Cliente(s) | `promotions.service` |
| Recomendación de nuevo estilo (IA) | `nuevo_estilo` | Cliente | `ai-recommendation.service` |
| Mensaje nuevo de chat | `nuevo_mensaje` | Receptor | `chat.service` |
| **Compra de productos lista para recoger** | `promocion` | Cliente | `orders.service` (`data.orderId`) |
| Cliente con app entra a la fila virtual | `fila_nuevo_cliente` | **Barbero** | `queue.service` (`join`) |
| Cita reservada completada (queda por cobrar) | `aviso_admin` | **Admin(s)** | `appointments.service` (`updateStatus`→COMPLETADA) |
| Atención de fila completada (queda por cobrar) | `aviso_admin` | **Admin(s)** | `queue.service` (`markServed`) |
| Nuevo mensaje del formulario de contacto | `aviso_admin` | **Admin(s)** | `contact.service` (+ email) |

> **Segmentación por rol (corregido):** las **promociones y difusiones**
> (`broadcast` / `promotions.notify` con audiencia `TODOS`) van **solo a
> clientes** — el staff (admin/barberos) ya **no** las recibe. Los avisos internos
> al admin usan `notifyAdmins()` (todos los `role=ADMIN` activos). Los invitados
> sin cuenta no reciben notificaciones.

> **Notificaciones al staff:** el barbero (el `User` dueño del perfil de barbero)
> recibe avisos cuando un cliente reserva, cancela o reprograma. El backend resuelve
> `barber.user` internamente. Ver detalle de contrato en `FRONTEND_PROMPT.md`
> (sección de notificaciones al barbero).

> **No se notifica a un destinatario que está activo/en línea** en el flujo de chat
> (regla ya implementada): si el receptor tiene la conversación abierta, no se
> genera push redundante.

> **Chat → admin (restricción por rol):** al **admin** solo lo notifican por chat
> los **barberos/empleados**. Un mensaje de un **cliente** al admin se guarda y se
> emite en vivo por WebSocket, pero **no** genera notificación push. El resto de
> combinaciones (barbero↔cliente, admin→cualquiera) notifica normalmente.
> Implementado en `chat.service` (`notifyRecipients` + `resolveRole`).

---

## 5. Integración con otros módulos (resumen técnico)

- `NotificationsModule` **exporta** `NotificationsService`, y lo consumen:
  `appointments`, `loyalty`/`promotions`, `waiting-list`, `queue`, `chat`,
  `ai-recommendation` y `orders`.
- La dependencia con `users` usa `forwardRef` (ciclo controlado) para resolver el
  `fcmToken` y la lista de usuarios activos del broadcast.
- Push delegado en `FirebaseService` (módulo `firebase`), con degradación elegante
  si no hay credenciales.

---

## 6. Estado de cobertura — huecos observables (informativo)

> Esta sección **solo describe** lo que el código muestra como incompleto. No es una
> propuesta ni un plan; es para que el equipo decida.

- **Push masivo en `broadcast`:** hoy persiste un registro por usuario pero **no
  envía push** (el multicast FCM está marcado como "integración futura" en el
  servicio). Un broadcast se ve en la lista pero no vibra el teléfono.
- **Tipos declarados sin disparador:** `recordatorio_corte` y `doble_check` existen
  en el enum pero **ningún módulo los emite** actualmente. Están reservados.
- **Contador de no leídas:** no hay endpoint dedicado (`unreadCount`); el front lo
  calcula filtrando la lista. Si la lista crece mucho, convendría un contador server-side.
- **Sin paginación:** `GET /notifications/:userId` devuelve **todas** las
  notificaciones del usuario (orden desc). No hay `limit`/`skip`; puede crecer.
- **Sin "marcar todas como leídas" ni borrado masivo:** solo hay acciones por `:id`.
- **`data` sin tipar por tipo:** el payload es libre (`Record<string, unknown>`); el
  front debe conocer, por convención, qué campos trae cada `type`.
- **Ownership de los endpoints de lectura:** ✅ **RESUELTO.** `GET /notifications/:userId`,
  `PATCH /:id/read` y `DELETE /:id` ahora validan pertenencia (dueño o admin);
  responden `403` ante acceso ajeno. Verificado end-to-end.

---

## Referencias

- Módulo: `src/modules/notifications/` (service, controller, schema, enums, dtos).
- Contrato de notificaciones al barbero y payloads por tipo: `FRONTEND_PROMPT.md`.
- Registro de token push: `PATCH /users/:id/fcm-token` (módulo users).
