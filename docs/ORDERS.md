# Compra de productos (Orders) — Urban Blade API

Compra de productos para **recoger en el local** (BOPIS: buy online, pick up in
store — **no hay envío a domicilio**). El cliente arma un carrito, paga (efectivo
al recoger o tarjeta por adelantado), y recoge el producto. El staff también
puede registrar **ventas en mostrador** manualmente. Todo descuenta stock.

Es un módulo **separado del ticket de servicio**: una compra de productos usa su
propio comprobante (`Order`), no el ticket de las citas.

## Enums

```ts
type OrderStatus  = "pendiente_pago" | "pagada" | "lista" | "recogida" | "cancelada";
type OrderChannel = "online" | "mostrador";
// método/estado de pago reutilizan los de payments:
type PaymentMethod = "efectivo" | "stripe";
type PaymentStatus = "pendiente" | "pagado" | "reembolsado";
```

## Forma de una orden (respuesta)

```ts
{
  _id: string;
  orderNumber: string;          // "OR-2026-0001"
  client: string;               // userId (o el invitado de mostrador)
  items: Array<{
    product: string;            // id del producto
    name: string;               // nombre congelado
    unitPrice: number;          // precio unitario congelado
    quantity: number;
    subtotal: number;           // unitPrice * quantity
  }>;
  total: number;
  status: OrderStatus;
  channel: OrderChannel;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  readyAt: string | null;       // cuando quedó lista para recoger
  pickedUpAt: string | null;
  notes: string;
  createdAt: string; updatedAt: string;
}
```

Los `items` **congelan** nombre y precio: aunque el producto cambie de precio o se
desactive después, el comprobante de la compra no cambia.

## Ciclo de vida de una compra online

```
pendiente_pago  →  (pagar)  →  pagada  →  (lista)  →  lista  →  (recoger)  →  recogida
                                   └────────── (recoger directo) ──────────┘
       │
       └── cancelada (en cualquier punto antes de recoger; devuelve stock si estaba pagada)
```

## Endpoints — CLIENTE

```ts
// 1) Crear la compra (carrito). NO descuenta stock aún; valida disponibilidad.
POST /orders     { items: [{ product, quantity }, ...] }
//   → data: Order (status "pendiente_pago", total calculado)
//   400 "Stock insuficiente para ..." si algún item no tiene stock

// 2a) Pagar en EFECTIVO (se paga al recoger; reserva el producto → descuenta stock):
PATCH /orders/:id/pay-cash
//   → data: Order (status "pagada")

// 2b) Pagar con TARJETA (Stripe, por adelantado):
POST /orders/:id/pay-stripe
//   → data: { clientSecret, amount, currency }
//   El stock se descuenta y la orden pasa a "pagada" cuando Stripe confirma (webhook).
//   Usa el clientSecret con presentPaymentSheet (ver docs/PAYMENTS.md).

// Consultar mis compras / una compra:
GET /orders/me      → data: Order[]   // mis compras, recientes primero
GET /orders/:id     → data: Order
```

> **Stock:** al **crear** la orden solo se valida que haya stock, pero no se
> descuenta. Se descuenta al **pagar** (efectivo o confirmación de Stripe). Por
> eso, entre crear y pagar, el stock podría agotarse; en ese caso el pago falla
> con `400 "Stock insuficiente ...; alguien lo compró antes"`. Es intencional:
> evita reservar stock de compras que nunca se pagan.

## Endpoints — STAFF (admin/barbero)

```ts
// Venta en MOSTRADOR: descuenta stock y queda pagada + recogida en el acto.
POST /orders/counter-sale
{ items: [{ product, quantity }], client?: "<userId>", guestName?: "...", paymentMethod?: "efectivo" }
//   → data: Order (status "recogida", channel "mostrador", pago "pagado")
//   400 "Stock insuficiente para ..." si no alcanza

// Marcar una orden pagada como LISTA para recoger (avisa al cliente por push):
PATCH /orders/:id/ready       → data: Order (status "lista")

// Marcar como RECOGIDA (entregada):
PATCH /orders/:id/picked-up   → data: Order (status "recogida")

// Cancelar (devuelve el stock si la orden estaba pagada/lista):
PATCH /orders/:id/cancel      → data: Order (status "cancelada")

// Listar todas las compras (admin):
GET /orders                   → data: Order[]
```

## Aviso "lista para recoger" (push)

Al marcar una orden como **lista** (`PATCH /orders/:id/ready`), el cliente recibe
una **notificación push** ("Tu compra está lista"), con el `orderNumber` y el
`orderId` en `data` para enrutar a su pantalla de compras.

## Stock — reglas

- **Compra online:** el stock se descuenta **al pagar** (no al crear ni al
  recoger), de forma **atómica** (evita sobreventa cuando dos compras concurren
  por el último producto).
- **Venta mostrador:** el stock se descuenta al registrar la venta.
- **Cancelación/devolución:** si se cancela una orden ya pagada, el stock se
  **devuelve** a cada producto.
- El admin sigue pudiendo ajustar stock manualmente con `PATCH /products/:id`.

## Cliente con cuenta vs invitado (mostrador)

La venta en mostrador acepta `client` (con cuenta) o `guestName` (sin cuenta). El
invitado se registra contra el usuario "Invitado de mostrador" genérico — igual
que en el walk-in de servicios — para que el comprobante y el registro de ventas
cuadren sin exigir cuenta.

## Comportamiento esperado en el FRONTEND

### Cliente — carrito y compra

1. **Tienda** (`GET /products`): grid con `image`, `name`, `price`, `stock`.
   Botón "Añadir al carrito" deshabilitado si `stock === 0`.
2. **Carrito** (estado local en el front): lista de `{ product, quantity }`, con
   subtotal y total calculados localmente (el backend recalcula al crear).
3. **Confirmar compra** → `POST /orders` con los items → recibe la orden
   `pendiente_pago`.
4. **Elegir pago:**
   - *Efectivo (pagar al recoger)* → `PATCH /orders/:id/pay-cash`. La orden queda
     `pagada` y reservada; el cliente paga en el local al recoger.
   - *Tarjeta* → `POST /orders/:id/pay-stripe` → `presentPaymentSheet` con el
     `clientSecret` (igual que en pagos de servicio). Al éxito, refresca la orden
     hasta ver `pagada` (lo marca el webhook).
5. **Mis compras** (`GET /orders/me`): lista con estado. Muestra:
   - `pendiente_pago` → "pagar" pendiente.
   - `pagada` → "en preparación".
   - `lista` → "**lista para recoger**" (destácalo; llegó push).
   - `recogida` → completada.
6. Al recibir el push de "lista para recoger", enruta a la pantalla de esa orden.

### Staff — mostrador y gestión

- **Venta rápida en mostrador:** selector de productos + cantidades → botón
  "Registrar venta" → `POST /orders/counter-sale`. Opción "cliente sin cuenta"
  (guestName). Descuenta stock y queda cerrada.
- **Panel de pedidos** (`GET /orders`): lista filtrable por estado; en las
  `pagada` botón "Marcar lista" (`ready`); en las `lista` botón "Entregar"
  (`picked-up`); botón "Cancelar" donde aplique.
- Tras cualquier acción, invalida `["orders"]` y `["products"]` (el stock cambió).

## Nota de diseño

- Una compra de productos **no** genera un ticket de servicio (`Ticket`) — usa su
  propia entidad `Order` con su `orderNumber` (`OR-AÑO-NNNN`).
- El pago con tarjeta reutiliza el **mismo Stripe** que los servicios, pero con su
  **propio webhook** (`POST /orders/stripe/webhook`) para no mezclar la
  confirmación de tickets y de órdenes.
