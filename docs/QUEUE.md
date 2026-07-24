# Fila virtual (walk-in queue) — Urban Blade API

Sistema para los clientes que **llegan sin cita** (walk-in). En lugar de un vago
"espérate", el sistema les da una **posición** y una **hora estimada** de
atención, y les avisa por push cuando su turno se acerca — para que puedan
irse a dar una vuelta en vez de esperar sentados.

La idea central: **un walk-in no es una excepción, es un tipo de espera** con su
propia agenda.

## Flujo

1. El cliente llega. Se registra en la fila: **él mismo** (cliente autenticado,
   p. ej. escaneando un QR del local) o el **staff** (admin/barbero) lo mete en
   dos taps desde el panel.
2. El sistema calcula su **posición** y **espera estimada** según la fila que
   tiene delante.
3. Cuando la espera baja a ~10 min, recibe un **push** ("Tu turno se acerca").
4. El barbero lo **llama** (otro push "Es tu turno") y luego lo marca como
   **atendido** → la fila avanza y todas las estimaciones se recalculan.

## Motor de estimación

Cada barbero tiene un "reloj" (minutos hasta quedar libre). Se recorren las
entradas en orden **FIFO**; cada una se asigna a su **barbero preferido**, o —si
eligió "cualquiera"— al **barbero con menor reloj** (el que se desocupa antes).
La espera estimada de una entrada es el reloj de su barbero **antes** de sumarle
su propio servicio.

Ejemplo (fila "cualquier barbero", secuencial):

| Cliente | Servicio | Posición | Espera estimada |
|---|---|---|---|
| A | 45 min | 1 | 0 min |
| B | 20 min | 2 | 45 min |
| C | 60 min | 3 | 65 min (45 + 20) |

La duración de cada servicio sale de `service.duration`. La posición y la espera
**no se persisten**: se calculan al vuelo en cada consulta, para que reflejen
siempre el estado real de la fila.

## Endpoints

Todos requieren autenticación (`@ApiBearerAuth`).

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| `POST` | `/queue` | cliente / staff | Unirse a la fila |
| `GET` | `/queue` | staff | Ver la fila completa |
| `GET` | `/queue/me` | cliente | Ver mi posición y espera |
| `DELETE` | `/queue/:id` | dueño / staff | Salir de la fila |
| `PATCH` | `/queue/:id/call` | staff | Llamar al cliente (su turno) |
| `PATCH` | `/queue/:id/served` | staff | Marcar como atendido |

### Unirse a la fila

```ts
POST /queue
{
  "service": "<serviceId>",     // requerido: define la duración
  "barber":  "<barberId>",      // opcional: preferido; omitir = cualquiera
  "client":  "<userId>"         // SOLO staff, para registrar a otra persona;
                                 // un cliente que se une a sí mismo NO lo envía
}
//   → data: QueueEntryView (con position y estimatedWaitMinutes)
//   Errores: 400 "Ya estás en la fila de espera" (no se permiten 2 entradas activas),
//            403 si un no-staff intenta registrar a otro (`client` ≠ su id).
```

### Forma de `QueueEntryView` (respuesta)

```jsonc
{
  "id": "...",
  "client": "<userId>" | null,     // null si es invitado sin cuenta
  "guestName": "Juan Pérez" | null,// nombre del invitado (si client es null)
  "guestPhone": "+506..." | null,
  "barber": "<barberId>" | null,   // null = cualquiera
  "service": "<serviceId>",
  "status": "esperando",           // esperando | llamado | atendido | cancelado | expirado
  "position": 2,                   // 1 = siguiente
  "estimatedWaitMinutes": 45,      // minutos estimados hasta ser atendido
  "createdAt": "2026-07-21T..."
}
```

### Consultar mi lugar (cliente)

```ts
GET /queue/me     → data: QueueEntryView | null   (null si no estás en la fila)
```

En la app del cliente: consulta `/queue/me` para mostrar "Eres el #N, ~M min".
Refresca periódicamente o al recibir el push.

### Avanzar la fila (staff)

```ts
PATCH /queue/:id/call     → marca "llamado" y notifica al cliente ("Es tu turno")
PATCH /queue/:id/served   → marca "atendido"; sale de la fila y el resto avanza
DELETE /queue/:id         → sale de la fila (cancelado)
```

## Aviso "tu turno se acerca" (~10 min)

Un **cron cada minuto** (`QueueCron.notifySoon`) revisa la fila y envía un push a
las entradas cuya `estimatedWaitMinutes` bajó a **≤ 10 min** y que aún no fueron
avisadas. Se envía **una sola vez** por entrada (marca `soonNotifiedAt`).

El push (tipo `recordatorio_cita`) trae en `data` el `queueEntryId`, para que el
tap del cliente lo lleve a su pantalla de fila.

## Estados

| Estado | Significado |
|---|---|
| `esperando` | en la fila, aguardando turno |
| `llamado` | el barbero lo llamó (es su turno / está siendo atendido) |
| `atendido` | completó su atención; salió de la fila |
| `cancelado` | el cliente o el staff lo sacó |
| `expirado` | fue llamado pero no se presentó a tiempo (sale de la fila) |

## Detalles técnicos

| Aspecto | Valor |
|---|---|
| Módulo | `src/modules/queue/` |
| Colección | `queueentries` |
| Motor | `QueueService.computeState()` (al vuelo, FIFO por barbero) |
| Cron | `QueueCron.notifySoon` (cada minuto) |
| Duración | de `service.duration` |

## Invitado sin cuenta (walk-in anónimo)

El **staff** puede registrar en la fila a alguien **sin cuenta**, enviando
`guestName` (y opcionalmente `guestPhone`) en lugar de `client`:

```ts
POST /queue
{ "service": "<id>", "guestName": "Juan Pérez", "guestPhone": "+506...", "barber": "<id>?" }
//   → data: QueueEntryView con client=null, guestName, guestPhone
```

- Solo **staff** (admin/barbero) puede registrar invitados (`403` si no).
- Un invitado ocupa su lugar y espera igual que cualquiera, pero **no recibe
  push** (no tiene cuenta): el staff lo llama a viva voz. En `QueueEntryView`,
  `client` es `null` y se muestran `guestName`/`guestPhone`.

## Cruce con las citas agendadas

El motor **considera las citas ya reservadas** del día: el "reloj" de cada
barbero **no arranca en 0**, sino en los **minutos que aún tiene comprometidos**
en citas activas (`pendiente`/`confirmada`) desde la hora actual hasta el fin de
cada cita.

Es decir, un walk-in para un barbero que tiene una cita que termina en 30 min
tendrá una espera estimada de **≥ 30 min** (espera a que el barbero termine su
agenda antes de atenderlo). Para el modo "cualquier barbero", el reloj arranca en
el **menor** compromiso (el barbero que se desocupa antes).

Fuente: `AppointmentsService.getCommittedMinutesByBarber()`.

## Integración con no-show (los dos problemas se resuelven entre sí)

Como la fila calcula el estado **al vuelo** leyendo las citas activas, cuando una
cita agendada se marca `no_asistio` (o se cancela), **deja de contar** en el
compromiso del barbero: el hueco se **libera automáticamente** y las esperas de
la fila **se recalculan solas** en la siguiente consulta (y el cron de ~10 min
reevalúa los avisos en ≤ 1 min).

No hace falta ninguna acción manual ni acoplar los módulos: el no-show de una
cita hace avanzar la fila por sí mismo.

## Expiración automática de entradas "llamado"

Si un cliente es **llamado** (su turno) pero **no se presenta** —el staff no lo
marca como `atendido`— dentro de **10 minutos**, la entrada pasa a `expirado` y
**sale de la fila** (así no bloquea al barbero indefinidamente).

- Lo hace el cron cada minuto (`QueueService.expireStaleCalled()`), comparando
  `calledAt` contra el umbral (`CALLED_EXPIRY_MINUTES = 10`).
- Si el cliente tenía cuenta, recibe un push avisándole que perdió su turno y que
  puede volver a unirse.
- El staff que llamó al cliente lo marca como `served` a tiempo para evitar la
  expiración; si el cliente aparece justo después de expirar, se vuelve a unir.

## Siguientes pasos (aún pendientes)

- **QR físico** en el local que abra el flujo de auto-registro del cliente
  (frontend).
