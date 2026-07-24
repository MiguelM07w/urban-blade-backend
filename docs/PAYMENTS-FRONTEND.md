# Petición: corregir el consumo de pagos de servicios (frontend)

> Documento listo para pasar al equipo de **frontend**. Describe cómo debe
> consumirse el pago de un ticket de servicio y corrige tres fallos detectados en
> la app. **El backend ya funciona correctamente** (ticket ↔ pago están
> vinculados); los cambios son del lado del cliente.

## Contexto en una frase

Se paga un **ticket** (generado al completar una cita **o una atención de la fila
virtual**). El monto y el cliente los toma el backend del propio ticket. Hay dos
métodos: **efectivo** y **tarjeta** (Stripe). **El cobro lo hace SOLO el
admin/recepción** — el barbero atiende, no cobra (ver §4).

```ts
type PaymentMethod = "efectivo" | "stripe";
type PaymentStatus = "pendiente" | "pagado" | "reembolsado";
```

---

## Problemas detectados y su corrección

### 1. El ticket mostraba "efectivo" aunque se pagara con tarjeta → CORREGIDO EN BACKEND

**Síntoma:** un ticket pagado con tarjeta mostraba `paymentMethod: "efectivo"`.

**Causa (era del backend, ya corregida):** el `Payment` sí nacía con
`method: "stripe"`, pero el **ticket** no reflejaba el método real:
- el enum `PaymentMethod` del ticket **solo** tenía `efectivo` (no existía tarjeta);
- `markAsPaid` (que ejecuta el webhook) actualizaba **solo** el `paymentStatus`,
  nunca el `paymentMethod`, así que el ticket se quedaba con su default `efectivo`.

**Corrección aplicada (backend):**
- El enum del ticket ahora incluye `tarjeta`.
- Al confirmar un pago (efectivo o webhook de Stripe), el backend **propaga el
  método real** al ticket: un pago con tarjeta deja el ticket en
  `paymentMethod: "tarjeta"`. Verificado end-to-end contra la BD.

**Lo que el front debe saber ahora:**
- `Ticket.paymentMethod` puede ser `"efectivo"` **o `"tarjeta"`**. Contempla ambos
  en la UI del recibo.
- Sigue usando el endpoint correcto según el método (no cambió):

| Método | Endpoint | Quién lo llama |
|---|---|---|
| Efectivo | `POST /payments` | **Solo admin** |
| Tarjeta | `POST /payments/stripe/intent` | **Solo admin** |

> **Cambio de rol (importante):** ambos endpoints de cobro son ahora **solo
> `admin`**. Un barbero o un cliente recibe **`403`** si intenta cobrar. El cobro
> está centralizado en el admin/recepción. Ver §4 para el flujo completo.

---

### 2. El ticket sigue "pendiente" aunque el cobro con tarjeta fue exitoso

**Síntoma:** `presentPaymentSheet` termina sin error (el dinero se cobró) pero el
ticket sigue en `pendiente`.

**Causa:** el ticket **no** se marca pagado con la respuesta del sheet. Se marca
pagado cuando **Stripe notifica al backend por webhook**
(`payment_intent.succeeded` → `POST /payments/stripe/webhook`). Si el webhook no
está configurado, o si el front asume "pagado" al cerrarse el sheet, el estado
nunca se actualiza en la UI.

**Corrección (frontend):** tras un cobro sin error, **haz polling** del estado
hasta ver `pagado` (llega en segundos). No des el pago por confirmado con el sheet.

```ts
// Tras presentPaymentSheet() sin error:
async function esperarPago(paymentId: string) {
  for (let i = 0; i < 10; i++) {
    const { data } = await api.get(`/payments/${paymentId}`);
    if (data.status === "pagado") return true;       // ✅ confirmado por webhook
    if (data.status === "reembolsado") return false;
    await new Promise((r) => setTimeout(r, 1500));    // reintenta ~15s
  }
  return false; // sigue pendiente: muestra "procesando, revisa en un momento"
}
```

> **La fuente de verdad es `status` del pago/ticket, NO `presentPaymentSheet`.**

**Corrección (infra/backend — verificar):** el webhook debe estar configurado
para que esto funcione. Sin esto, el cobro se realiza pero **el ticket nunca pasa
a `pagado`**.

En **local** con Stripe CLI — ⚠️ la URL debe llevar el prefijo **`/api`** y la
ruta completa **`/payments/stripe/webhook`** (un error aquí es causa típica de
"se queda pendiente"):

```bash
# ✅ CORRECTO (nota el /api y /stripe/webhook):
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook

# ❌ INCORRECTO (falta /api y la ruta es equivocada → 404):
stripe listen --forward-to localhost:3000/payments/webhook
```

Además:
- El **servidor debe estar corriendo** (`pnpm start:dev`) al lanzar `stripe listen`;
  si ves `connection refused` / `target machine actively refused`, el backend
  está apagado.
- `stripe listen` imprime un **signing secret** (`whsec_...`). Cópialo a
  `STRIPE_WEBHOOK_SECRET` en el `.env` del backend y **reinícialo**; si no, el
  backend rechaza el webhook con "Firma del webhook no válida" aunque llegue.
  (Ese secret cambia cada vez que reinicias `stripe listen`.)
- Comprueba en la terminal de Stripe que el evento `payment_intent.succeeded`
  devuelve **`[200]`** (no 404 ni 400).

---

### 3. El pago en efectivo también se muestra "pendiente"

**Síntoma:** el staff cobra en efectivo, el backend responde OK, pero la UI sigue
mostrando el ticket como `pendiente`.

**Causa:** el backend marca el ticket como `pagado` **de inmediato** al hacer
`POST /payments`. Si la UI no lo actualiza, es porque **no está releyendo** el
ticket (estado cacheado).

**Corrección:** tras cobrar, **invalida y vuelve a pedir** el ticket y los pagos.
No confíes en el estado en memoria.

```ts
await api.post("/payments", { ticket: ticketId, method: "efectivo" });
queryClient.invalidateQueries({ queryKey: ["tickets", ticketId] });
queryClient.invalidateQueries({ queryKey: ["payments"] });
```

---

## 4. Cobro de una atención de la FILA VIRTUAL (separación atención / cobro)

En la fila virtual, el **barbero atiende pero NO cobra**. Al marcar a alguien como
atendido, el backend genera un **ticket PENDIENTE** de pago, y el **admin/recepción**
lo cobra después (efectivo o tarjeta). Esto separa "quien atiende" de "quien maneja
el dinero".

### Flujo de punta a punta

```ts
// 1) BARBERO (o admin) marca atendido — NO cobra; genera ticket pendiente:
PATCH /queue/:id/served   { barberId? }   → data: null
//   - Crea cita completada + ticket PENDIENTE (reutiliza el flujo del walk-in
//     SIN cobrar). Cliente con cuenta suma puntos/trust y recibe su notif de
//     ticket; invitado sin cuenta solo genera el ticket.
//   - `barberId` opcional: solo si la entrada NO fijaba barbero ("cualquiera") y
//     quien marca atendido es ADMIN (sin perfil de barbero). Si lo marca un
//     BARBERO, se usa su propio perfil. 400 si falta y no se puede resolver.
//   - Avisa a los admins (push `aviso_admin`, título "Cobro pendiente (fila)")
//     con data: { queueEntryId, ticketId, barberId, clientId, guestName }.

// 2) ADMIN ve la cola de cobro (NO dependas solo del push, es best-effort):
GET /tickets?paymentStatus=pendiente   (admin)   → data: Ticket[]
//   Lista los tickets aún no cobrados (citas completadas + atenciones de fila).
//   `client` viene poblado (name/email). Para invitados, usa el guestName que
//   llegó en el push (no hay cuenta consultable).
//
//   Cuándo entra un ticket a esta cola (ambos avisan al admin con `aviso_admin`):
//    - Cita RESERVADA que el barbero marca completada → push "Cobro pendiente
//      (cita)" con data { appointmentId, ticketId, clientId }.
//    - Atención de FILA marcada como atendida → push "Cobro pendiente (fila)"
//      con data { queueEntryId, ticketId, barberId, clientId, guestName }.
//   (El walk-in NO entra: cobra en el acto.)

// 3) ADMIN cobra ese ticket — efectivo o tarjeta (ver flujos abajo):
POST /payments                 { ticket, method: "efectivo" }   // efectivo
POST /payments/stripe/intent   { ticket }                        // tarjeta → PaymentSheet
```

### Notas para el front

- La fila **no muestra "pagado"** al marcar atendido: el ticket queda `pendiente`.
  El "pagado" aparece cuando el admin lo cobra en el paso 3.
- El **formulario de Stripe SÍ se despliega** en este flujo (paso 3 → PaymentSheet),
  porque el cobro pasa por `/payments/stripe/intent` (2 pasos), no por un endpoint
  atómico. (Esto resuelve el síntoma de "no salía el formulario" que se veía cuando
  el cobro se intentaba desde el walk-in atómico.)
- Enruta el push `aviso_admin` → pantalla de cobro del ticket usando `data.ticketId`;
  muestra "Cobrar a {guestName | client.name}" con los datos del `data`.

---

## Flujo correcto — TARJETA (solo admin)

Requiere `@stripe/stripe-react-native` y la **Publishable Key** (`pk_...`) en
`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Envuelve la app en
`<StripeProvider publishableKey={...}>`.

```ts
// 1) Pedir el intento de pago al backend (sobre un ticket pendiente) — SOLO admin:
POST /payments/stripe/intent   (SOLO admin)   { ticket: "<ticketId>" }
//   → data: { clientSecret: string; paymentId: string; amount: number; currency: string }
//   400 "Los pagos con tarjeta no están disponibles..."  (Stripe no configurado en backend)
//   400 "Este ticket ya tiene un pago registrado"        (ya estaba pagado)
//   403 si lo intenta un barbero o un cliente (el cobro es solo del admin)

// 2) Cobrar la tarjeta en el móvil (la tarjeta NO pasa por tu backend):
import { useStripe } from "@stripe/stripe-react-native";
const { initPaymentSheet, presentPaymentSheet } = useStripe();

await initPaymentSheet({
  paymentIntentClientSecret: clientSecret,
  merchantDisplayName: "Urban Blade",
});
const { error } = await presentPaymentSheet();

// 3) Confirmar por polling (NO con el resultado del sheet):
if (!error) {
  const ok = await esperarPago(paymentId);   // ver punto 2 arriba
  // ok === true → ticket pagado. Refresca ticket y lista de pagos.
}
```

## Flujo correcto — EFECTIVO (solo admin)

```ts
POST /payments   (SOLO admin)   { ticket: "<ticketId>", method?: "efectivo", notes?: string }
//   → data: Payment (status "pagado"); el ticket queda pagado al instante.
//   400 "Este ticket ya tiene un pago registrado" si ya se pagó.
//   403 si lo intenta un barbero (el cobro es solo del admin).
// Después: invalida ["tickets", id] y ["payments"] y relee.
```

## Consultar el estado

```ts
GET /payments/:id               (auth)   → data: Payment
GET /payments/client/:clientId  (auth)   → data: Payment[]   // historial del cliente
GET /payments                   (admin)  → data: Payment[]   // todos, recientes primero
```

## Forma de la respuesta `Payment`

```ts
{
  _id: string;
  ticket: string | { ticketNumber, price };   // poblado en listados
  client: string;
  amount: number;
  method: "efectivo" | "stripe";
  status: "pendiente" | "pagado" | "reembolsado";
  paidAt: string | null;
  notes: string;
  stripePaymentIntentId: string | null;        // solo pagos con tarjeta
  createdAt: string; updatedAt: string;
}
```

---

## Checklist de aceptación

- [ ] El recibo contempla `Ticket.paymentMethod` = `"efectivo"` **o `"tarjeta"`**
      (el backend ya refleja el método real; corregido).
- [ ] **El cobro (efectivo y tarjeta) está SOLO en la UI del admin/recepción**;
      el barbero no tiene botones de cobro (recibiría `403`).
- [ ] La UI del admin usa `GET /tickets?paymentStatus=pendiente` como **cola de
      cobro** (citas y atenciones de fila), no depende solo del push.
- [ ] Al marcar `served` en la fila, la UI **no** muestra el ticket como pagado
      (queda `pendiente` hasta que el admin lo cobre).
- [ ] `stripe listen` apunta a `localhost:3000/api/payments/stripe/webhook` y el
      `whsec_...` está en `STRIPE_WEBHOOK_SECRET` del backend.
- [ ] El estado "pagado" en tarjeta se determina por **polling** de
      `GET /payments/:id`, no por el resultado de `presentPaymentSheet`.
- [ ] El webhook de Stripe está configurado en el backend
      (`STRIPE_WEBHOOK_SECRET` + endpoint público a `POST /payments/stripe/webhook`).
- [ ] Tras cualquier pago (efectivo o tarjeta) la UI **invalida y relee** el
      ticket y `["payments"]`; no muestra estado cacheado.
- [ ] `<StripeProvider>` con `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_...`)
      envuelve la app.

> Referencia técnica del backend: `docs/PAYMENTS.md`. Contrato resumido en la
> sección "Pagos" de `FRONTEND_PROMPT.md`.
