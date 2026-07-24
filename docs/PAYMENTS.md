# Pagos — Urban Blade API

Cobro de un **ticket** (generado al completar una cita) por dos métodos:
**efectivo** (lo registra el staff) y **tarjeta** (Stripe, procesado por la
pasarela). El pago se hace **sobre el ticket** — el monto y el cliente se toman
del ticket, no del body, para evitar inconsistencias.

## Enums

```ts
type PaymentMethod = "efectivo" | "stripe";
type PaymentStatus = "pendiente" | "pagado" | "reembolsado";
```

## Forma de un pago (respuesta)

```ts
{
  _id: string;
  ticket: string | { ticketNumber, price };  // poblado en listados
  client: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  notes: string;
  stripePaymentIntentId: string | null;       // solo pagos con tarjeta
  stripeCustomerId: string | null;
  createdAt: string; updatedAt: string;
}
```

## Método 1 — Efectivo (staff)

El barbero/admin registra el pago en efectivo. Queda `pagado` de inmediato y el
ticket se marca como pagado.

```ts
POST /payments        (staff: barber/admin)
{ "ticket": "<ticketId>", "method": "efectivo"?, "notes": "..."? }
//   → data: Payment (status "pagado")
//   Error: 400 "Este ticket ya tiene un pago registrado" (no se paga dos veces)
```

## Método 2 — Tarjeta (Stripe)

Flujo de **dos pasos** con la pasarela: el backend crea un `PaymentIntent`, el
**móvil cobra la tarjeta** con el SDK de Stripe usando el `clientSecret`, y Stripe
**confirma** el cobro al backend por **webhook**.

### Paso 1 — Crear el intento de pago (móvil)

```ts
POST /payments/stripe/intent     (auth: client/staff)
{ "ticket": "<ticketId>" }
//   → data: { clientSecret, paymentId, amount, currency }
//   Errores: 400 "Los pagos con tarjeta no están disponibles..." (Stripe no configurado),
//            400 "Este ticket ya tiene un pago registrado"
```

Se crea un `Payment` local en estado **`pendiente`** con el `stripePaymentIntentId`.

### Paso 2 — Cobrar en el móvil (Stripe SDK)

El frontend usa el `clientSecret` con `@stripe/stripe-react-native`
(`initPaymentSheet` + `presentPaymentSheet`) para que el cliente introduzca la
tarjeta. **No pasa la tarjeta por tu backend** — la maneja Stripe directamente.

```ts
// (Expo/React Native, resumen)
import { useStripe } from "@stripe/stripe-react-native";
const { initPaymentSheet, presentPaymentSheet } = useStripe();
await initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: "Urban Blade" });
const { error } = await presentPaymentSheet();
// si !error → el cobro se hizo; el backend lo confirmará por webhook.
```

### Paso 3 — Confirmación (webhook, automático)

Stripe llama a este endpoint cuando el cobro tiene éxito. **El frontend no lo
usa** — es interno de la pasarela.

```
POST /payments/stripe/webhook     (público; verifica la firma de Stripe)
```

Al recibir `payment_intent.succeeded`, el backend marca el `Payment` como
`pagado` y el ticket como pagado. Es **idempotente**.

> **Importante para el frontend:** tras `presentPaymentSheet` sin error, muestra
> "pago exitoso", pero **la fuente de verdad es el estado del pago/ticket** que
> confirma el webhook (llega en segundos). Refresca el ticket/pago
> (`GET /payments/:id` o el ticket) para ver `status: "pagado"`.

## Consultar pagos

```ts
GET /payments                  (admin)  → data: Payment[]        // todos, recientes primero
GET /payments/client/:clientId (auth)   → data: Payment[]        // historial del cliente
GET /payments/:id              (auth)   → data: Payment
```

## Reembolso / cambiar estado (admin)

```ts
PATCH /payments/:id/status     (admin)
{ "status": "pendiente" | "pagado" | "reembolsado" }
//   → data: Payment
```

**Reembolso (`status: "reembolsado"`):**
- Si el pago es de **tarjeta (Stripe)** y está `pagado`, el backend ejecuta el
  **reembolso REAL en Stripe** (devuelve el dinero a la tarjeta del cliente).
- Si es de **efectivo**, solo cambia el estado local (el reembolso se hace en
  persona; no hay dinero que devolver por pasarela).
- En ambos casos, el **ticket vuelve a `pendiente`** de pago.
- Es idempotente por seguridad: reembolsar dos veces → `400 "Este pago ya fue
  reembolsado"`. Reembolsar un pago no pagado → `400`. Si Stripe no está
  configurado, reembolsar una tarjeta → `400` (no se puede devolver sin pasarela).

## Configuración (backend)

En `.env` (opcional; sin esto, el pago con tarjeta no está disponible pero el
efectivo sí):

```
STRIPE_SECRET_KEY=sk_test_xxx        # clave secreta de Stripe
STRIPE_WEBHOOK_SECRET=whsec_xxx      # secreto para verificar el webhook
STRIPE_CURRENCY=usd                  # moneda ISO (usd, crc, ...)
```

- El **frontend** necesita además la **Publishable Key** de Stripe
  (`pk_test_...`) en su propio `.env` (`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`),
  para inicializar el `StripeProvider`. Esa clave es pública; la secreta va solo
  en el backend.
- El webhook (`/api/payments/stripe/webhook`) debe registrarse en el dashboard
  de Stripe apuntando a tu URL pública, escuchando `payment_intent.succeeded`.
- Si Stripe no está configurado, el backend arranca igual (warning en log) y solo
  el efectivo funciona. Es una **degradación elegante** (como Firebase/Mail).

## Detalles técnicos

| Aspecto | Valor |
|---|---|
| Módulo | `src/modules/payments/` |
| Wrapper Stripe | `StripeService` (degrada si no hay key) |
| Confirmación | webhook `payment_intent.succeeded` |
| Raw body | `main.ts` con `rawBody: true` (para verificar la firma) |
| Monto | del `ticket.price` (nunca del body) |
| Moneda | Stripe usa la unidad mínima; el backend convierte (12.50 → 1250) |

## Recomendación de UI

- **Cliente:** en el detalle de un ticket **pendiente de pago**, botón "Pagar con
  tarjeta" → `POST /payments/stripe/intent` → `presentPaymentSheet` → al éxito,
  refresca el ticket hasta ver `pagado`.
- **Staff:** en un ticket pendiente, botón "Cobrar en efectivo" → `POST /payments`
  con `method: "efectivo"`.
- **Admin:** lista de pagos (`GET /payments`) con método, estado y monto; acción
  de reembolso/estado.
