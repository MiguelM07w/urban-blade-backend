# Atención directa / Walk-in — Urban Blade API

Registro **manual** por parte del staff de una atención que ocurrió **sin reserva
por la app**: un cliente que llegó, se atendió y pagó en el momento. En **una sola
acción** el sistema deja constancia contable completa y ocupa la agenda del
barbero.

Resuelve el problema real de la barbería: gente que no usa la app ni agenda, pero
cuya atención debe quedar registrada (ticket, estadísticas del barbero, pago) y
cuya hora debe bloquearse para que nadie más agende encima.

## Qué hace en una sola llamada

`POST /appointments/walk-in` (staff) crea de golpe:

1. Una **cita ya `completada`** (la atención ya ocurrió) en la hora indicada.
2. El **ticket** con el servicio, barbero, fecha y monto.
3. El **pago** (efectivo por defecto).
4. Cuenta en las **estadísticas del barbero** (es una cita completada real).
5. **Ocupa el slot** — al existir esa cita en esa hora, nadie más podrá agendar
   ni registrar otra atención que se solape (mecanismo `assertNoOverlap`).

## Endpoint

```
POST /appointments/walk-in     (admin/barbero)
```

### Body

```ts
{
  "barber": "<barberId>",        // requerido: quién atendió
  "service": "<serviceId>",      // requerido: qué servicio (define precio y duración)
  "date": "2026-07-22",          // requerido: fecha de la atención (ISO)
  "startTime": "15:30",          // requerido: hora de inicio (HH:mm); endTime se calcula por la duración

  // Cliente — UNO de los dos (o ninguno para invitado anónimo):
  "client": "<userId>",          // cliente CON cuenta → suma fidelización
  "guestName": "Pedro Pérez",    // cliente SIN cuenta → invitado (sin fidelización)

  "paymentMethod": "efectivo",   // opcional (default "efectivo"; también "stripe")
  "notes": "..."                 // opcional
}
//   → data: Appointment (status "completada")
```

### Errores

- `400 "La hora indicada está fuera del horario del barbero o cae en su descanso"`
  — la hora no cabe en el `schedule` del barbero.
- `400 "El barbero ya tiene una cita en ese horario"` — se solapa con otra cita o
  atención ya registrada.

## Con cuenta vs invitado

| | Cliente **con cuenta** (`client`) | **Invitado** (`guestName`) |
|---|---|---|
| Cita completada | ✅ | ✅ |
| Ticket + pago | ✅ | ✅ |
| Estadísticas del barbero | ✅ | ✅ |
| Bloquea el slot | ✅ | ✅ |
| **Fidelización (puntos)** | ✅ suma | ❌ no |
| **Trust-score** | ✅ suma | ❌ no |
| Notificación al cliente | ✅ | ❌ (no tiene cuenta) |

Los invitados se registran internamente contra un usuario genérico
("Invitado de mostrador"), para que ticket y estadísticas funcionen sin exigir una
cuenta por cada walk-in. Los descuentos de promoción/cupón personalizados **no**
aplican al invitado (no hay perfil); el cliente con cuenta sí recibe sus promos.

## Cómo se refleja (importante)

- **En el horario del barbero:** la atención aparece como una cita `completada` de
  ese día; **ocupa esa franja**. Si consultas `GET /appointments/available-slots`
  para ese barbero/fecha, esa hora ya **no** aparece disponible.
- **En las estadísticas del barbero** (`GET /barbers/:id/stats`): cuenta como una
  cita completada más (quién atendió, qué servicio, cuándo).
- **En el ticket/recibo:** se genera un ticket normal (`TB-AÑO-NNNN`) con el
  servicio, barbero, monto y estado de pago — igual que una cita normal
  completada. Consultable en `GET /tickets/...`.
- **En los pagos:** queda un `Payment` (`GET /payments`) con el método y monto.

## Comportamiento esperado en el FRONTEND

Esta pantalla es **solo para staff** (barbero/admin). Flujo:

1. **Botón "Registrar atención" / "Walk-in"** en el panel del barbero o admin
   (p. ej. en su agenda del día, o en la pantalla de la fila virtual).
2. **Formulario:**
   - **Servicio** (obligatorio) — selector de `GET /services`.
   - **Barbero** (obligatorio) — si lo abre un barbero, prellena con el suyo; si
     es admin, selector de `GET /barbers`.
   - **Fecha y hora** — por defecto **ahora** (fecha de hoy + hora actual
     redondeada); editable.
   - **Cliente:** conmutador entre:
     - *"Cliente registrado"* → buscar/seleccionar un usuario (envía `client`).
     - *"Sin cuenta"* → campo de **nombre** (envía `guestName`).
   - **Método de pago:** efectivo (default) o tarjeta.
3. **Enviar** → `POST /appointments/walk-in`. Muestra el `message` de éxito o el
   error (`400`) en un toast.
4. **Tras registrar:** invalida las queries de la agenda del barbero
   (`["barber-appointments", barberId]`), sus slots
   (`["available-slots", barberId, date]`), sus stats (`["barber", barberId]`), y
   los tickets/pagos si esas pantallas están abiertas.

### Sugerencia de UX

- Como el caso típico es "acaba de pasar", prellena fecha/hora con el momento
  actual para que sea de **dos taps** (servicio + confirmar).
- Si el barbero tiene la **fila virtual** abierta y atiende a alguien de la fila,
  ofrece un botón "Registrar y cobrar" que llame a este endpoint con los datos de
  esa entrada (barbero, servicio) — así el walk-in queda contabilizado y su hora
  bloqueada. (La fila y este registro son piezas separadas; el front puede
  encadenarlas.)

## Nota de diseño

- El walk-in **no** pasa por el flujo de reserva del cliente (`POST /appointments`)
  ni por sus validaciones de trust-score/doble-check/deadline — es un registro de
  algo ya ocurrido, por eso tiene su propio endpoint.
- El bloqueo de horario sale **gratis**: una cita `completada` de hoy ya cuenta
  como "ocupado" en el cálculo de slots y en la validación de solapamiento.
