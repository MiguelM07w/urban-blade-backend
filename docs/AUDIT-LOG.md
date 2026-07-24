# Audit Log — Urban Blade API

Registro de acciones sensibles del sistema para **trazabilidad y evidencia de
controles de seguridad** (ISO 27001, auditoría interna). Cada acción marcada se
persiste en MongoDB con quién la hizo, desde dónde, sobre qué y con qué resultado.

## Cómo funciona

1. Un **decorador `@Audit(AuditAction.X)`** marca los endpoints sensibles.
2. Un **interceptor global** (`AuditInterceptor`) detecta esa marca y, tras
   ejecutar el handler, registra el evento — tanto si **tuvo éxito** como si
   **falló** (captura la excepción, la registra y la vuelve a lanzar).
3. El registro es **best-effort**: un fallo al auditar nunca rompe la operación
   de negocio que lo originó.

No hay que llamar a nada manualmente: basta con anotar el endpoint.

```ts
@Patch('users/:id/role')
@Roles(Role.ADMIN)
@Audit(AuditAction.USER_ROLE_CHANGED)   // ← solo esto
changeRole(...) { ... }
```

## Qué se registra por cada evento

| Campo | Descripción |
|---|---|
| `action` | Tipo de acción (`AuditAction`) |
| `outcome` | `success` \| `failure` |
| `actor` | Id del usuario que ejecutó la acción (null si anónimo, p. ej. login) |
| `actorEmail` / `actorRole` | Copia del email y rol del actor en el momento |
| `method` / `path` | Método y ruta HTTP |
| `ip` | IP de origen (respeta `x-forwarded-for` para proxies/Render) |
| `targetId` | Recurso afectado (`:id`/`:userId` de la ruta) |
| `statusCode` | Código HTTP de la respuesta |
| `detail` | Mensaje de error si falló |
| `createdAt` | Marca de tiempo (solo `createdAt`, inmutable) |

## Acciones auditadas actualmente

| Acción | Endpoint |
|---|---|
| `login_success` (con outcome success/failure) | `POST /auth/login` |
| `password_reset` | `POST /auth/reset-password` |
| `user_created` | `POST /admin/users` |
| `user_role_changed` | `PATCH /admin/users/:id/role` |
| `user_blocked` | `PATCH /admin/users/:id/block` |
| `user_unblocked` | `PATCH /admin/users/:id/unblock` |
| `user_deleted` | `DELETE /users/:id` |
| `appointment_cancelled` | `PATCH /appointments/:id/cancel` |
| `appointment_status_changed` | `PATCH /appointments/:id/status` |
| `service_updated` | `PATCH /services/:id` |
| `promotion_created` | `POST /promotions` |
| `coupon_created` | `POST /loyalty/coupons` |
| `trust_score_restored` | `PATCH /trust-score/:userId/restore` |

> **Nota sobre login:** el registro de login usa la acción `login_success` y el
> campo `outcome` distingue el resultado — `success` para credenciales válidas
> (200) y `failure` para intentos fallidos (401). En login fallido el `actor` es
> anónimo (aún no hay token), pero sí se registra la **IP** y la ruta, que es la
> evidencia útil de un intento de acceso no autorizado.

## Consultar los registros (admin)

```
GET /api/audit-logs        (admin) — paginado y filtrable
```

Query params (todos opcionales):

| Param | Descripción |
|---|---|
| `page` | Página (default 1) |
| `limit` | Por página (default 20, máx 100) |
| `action` | Filtrar por una `AuditAction` |
| `actor` | Filtrar por id de usuario (actor) |

Respuesta (`data`):

```jsonc
{
  "items": [
    {
      "_id": "...",
      "action": "user_role_changed",
      "outcome": "success",
      "actor": "6a4c...",
      "actorEmail": "admin@urbanblade.com",
      "actorRole": "admin",
      "method": "PATCH",
      "path": "/api/admin/users/6a4c.../role",
      "ip": "::1",
      "targetId": "6a4c...",
      "statusCode": 200,
      "detail": "",
      "createdAt": "2026-07-21T..."
    }
  ],
  "total": 42, "page": 1, "limit": 20
}
```

### Ejemplos

```
GET /api/audit-logs?action=login_success&limit=50   # intentos de login
GET /api/audit-logs?actor=<userId>                   # todo lo que hizo un usuario
GET /api/audit-logs?action=user_deleted             # borrados de cuenta
```

## Detalles técnicos

| Aspecto | Valor |
|---|---|
| Módulo | `src/modules/audit-log/` (`@Global`) |
| Interceptor | `AuditInterceptor` (registrado con `APP_INTERCEPTOR`) |
| Decorador | `@Audit(action)` (`src/modules/audit-log/decorators/`) |
| Colección Mongo | `auditlogs` |
| Consulta | `GET /audit-logs` (solo admin) |
| Retención | Sin borrado automático (los registros se conservan) |

### Cómo auditar un endpoint nuevo

1. Añade el valor a `AuditAction` (`enums/audit-action.enum.ts`).
2. Anota el endpoint con `@Audit(AuditAction.TU_ACCION)`.

Eso es todo — el interceptor global se encarga del resto.

## Valor para documentación de seguridad (ISO 27001 / controles)

Este registro es evidencia directa de varios controles:

- **A.9 Control de acceso** — intentos de login (éxito/fallo con IP).
- **A.12.4 Registro y monitoreo** — trazabilidad de acciones sobre datos y config.
- **Trazabilidad de cambios sensibles** — quién cambió roles, precios, canceló
  citas, restauró trust scores, borró cuentas.

El campo `actorEmail`/`actorRole` se **congela** en el momento del evento, por lo
que el histórico sigue siendo válido aunque el usuario cambie de rol o se elimine.
