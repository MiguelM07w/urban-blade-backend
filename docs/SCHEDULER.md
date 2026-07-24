# Tareas programadas (Cron) — Urban Blade API

Tareas que corren en segundo plano con [`@nestjs/schedule`](https://docs.nestjs.com/techniques/task-scheduling).
Viven en `src/modules/appointments/appointments.cron.ts` (`AppointmentsCron`).

## Tareas activas

| Tarea | Frecuencia | Módulo | Qué hace |
|---|---|---|---|
| `cancelUnconfirmedAppointments` | cada 30 min | appointments | Cancela citas `pendiente` no confirmadas cuyo `confirmationDeadline` ya pasó. |
| `sendAppointmentReminders` | cada 15 min | appointments | Envía recordatorios de cita **~24h antes** y **~1h antes**. |
| `cleanupExpiredRefreshTokens` | diario (3 AM) | auth | Limpia los hashes de refresh tokens ya expirados. |

## Recordatorios de cita (24h y 1h)

Cuando se acerca una cita activa (`pendiente` o `confirmada`), el cliente recibe
una **notificación push** (tipo `recordatorio_cita`):

- **~24 h antes:** "Tu cita es mañana a las HH:mm. ¡Te esperamos!"
- **~1 h antes:** "Tu cita es en 1 hora a las HH:mm. ¡Te esperamos!"

### Cómo evita duplicados

Cada cita lleva dos flags que se marcan al enviar cada recordatorio, de modo que
**cada uno se envía una sola vez** aunque el cron corra muchas veces:

```ts
reminder24hSent: boolean   // ya se envió el de 24h
reminder1hSent:  boolean   // ya se envió el de 1h
```

- El cron corre cada 15 min, así que el recordatorio de "1h antes" tiene una
  precisión de ±15 min (suficiente para un aviso).
- Si el cliente **reserva con menos de 1h de antelación**, solo recibe el de 1h
  (el de 24h se marca como enviado pero **no se dispara**, para no mandar dos
  notificaciones casi juntas).
- Si reserva entre 1h y 24h antes, recibe el de 24h de inmediato en la siguiente
  pasada, y el de 1h cuando corresponda.
- Las citas creadas **antes** de esta función (sin los flags) también reciben
  recordatorios: el filtro usa `$ne: true`, que cubre `false` y `undefined`.

### Estados considerados

Solo se recuerdan citas en estado `pendiente` o `confirmada`. Las `completada`,
`cancelada` y `no_asistio` se ignoran.

### Entrega (push)

El recordatorio se envía con `NotificationsService.createForUser` → se persiste
en la bandeja del usuario **y** dispara el push FCM (best-effort). Como el resto
de notificaciones: si Firebase no está configurado, se registra en log; en cuanto
se configure, los push llegan sin cambios.

## Limpieza de refresh tokens expirados

Cada login guarda el **hash** del refresh token en el usuario
(`hashedRefreshToken`) junto con su fecha de expiración (`refreshTokenExpiresAt`
= ahora + `jwt.refreshExpiresIn`, por defecto 7 días). Un cron diario (3 AM) pone
a `null` ambos campos en los usuarios cuyo token ya venció.

- Es **higiene de datos**, no una brecha: un refresh token expirado ya no es
  utilizable (el JWT no valida al refrescar aunque el hash siguiera en la BD).
- El logout también limpia estos campos de inmediato.
- La query solo toca usuarios con `refreshTokenExpiresAt <= ahora`, así que las
  sesiones vigentes no se ven afectadas.

Lógica en `UsersService.cleanupExpiredRefreshTokens()`, disparada por
`AuthCron` (`src/modules/auth/auth.cron.ts`).

## Detalles técnicos

| Aspecto | Valor |
|---|---|
| Módulo | `AppointmentsModule` (el `ScheduleModule.forRoot()` está en `AppModule`) |
| Archivo | `src/modules/appointments/appointments.cron.ts` |
| Lógica | `AppointmentsService.sendDueReminders()` / `autoCancelUnconfirmed()` |
| Flags en la cita | `reminder24hSent`, `reminder1hSent` |
| Tipo de notificación | `recordatorio_cita` |

> **Nota sobre despliegue:** en Render free tier el servicio se **suspende** por
> inactividad; mientras está dormido, los crons **no corren**. Para que las tareas
> programadas se ejecuten de forma fiable, mantén el servicio despierto con el
> keep-alive de `/api/health` (ver `docs/HEALTH.md`) o usa un plan que no se
> suspenda.

### Añadir una tarea nueva

1. Añade un método al `AppointmentsCron` (o crea un `*.cron.ts` en el módulo que
   corresponda y regístralo como provider).
2. Anótalo con `@Cron(CronExpression.X)` o una expresión cron literal
   (`'0 */15 * * * *'` = cada 15 min).
3. Mantén la lógica en el **service** (el cron solo orquesta), y hazla
   **idempotente** (marca lo ya procesado) porque el cron se repite.
