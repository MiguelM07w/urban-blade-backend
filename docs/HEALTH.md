# Health Check — Urban Blade API

Endpoint de monitoreo del estado del servicio y su conexión a la base de datos.
Construido con [`@nestjs/terminus`](https://docs.nestjs.com/recipes/terminus).

## Endpoint

```
GET /api/health
```

- **Público** (no requiere token) — para poder usarse como keep-alive y monitoreo externo.
- Verifica la **conexión a MongoDB Atlas** con un `pingCheck` (timeout 3 s).
- **200 OK** si todos los indicadores están sanos; **503 Service Unavailable** si alguno falla.

### Respuesta OK (200)

La respuesta va envuelta en el formato estándar de la API (`ResponseInterceptor`):

```jsonc
{
  "success": true,
  "data": {
    "status": "ok",
    "info":    { "mongodb": { "status": "up" } },
    "error":   {},
    "details": { "mongodb": { "status": "up" } }
  },
  "message": "Operación exitosa",
  "statusCode": 200,
  "timestamp": "2026-07-21T01:36:12.169Z"
}
```

### Respuesta con fallo (503)

Si la base de datos no responde, el `status` interno pasa a `"error"`, el detalle del
indicador afectado aparece en `error`/`details`, y el código HTTP es **503**. Un
monitor externo debe tratar cualquier código distinto de `200` como "servicio caído".

## Casos de uso

### 1. Keep-alive en Render (free tier)

El plan gratuito de Render **suspende** el servicio tras un periodo de inactividad,
y el primer request después de dormirse tarda varios segundos en responder (cold start).
Para evitar que se duerma antes de una demo, se configura un ping periódico a `/api/health`:

- **UptimeRobot / Cron-job.org / BetterUptime:** crea un monitor HTTP(s) que haga
  `GET https://<tu-servicio>.onrender.com/api/health` cada 5–10 minutos.
- Al ser público y ligero (solo un ping a Mongo), es seguro llamarlo con frecuencia.

### 2. Health check de la plataforma

Render (y la mayoría de PaaS) permiten declarar un **Health Check Path**. Configúralo a:

```
/api/health
```

Así la plataforma reinicia el contenedor automáticamente si el endpoint deja de
responder 200.

### 3. Evidencia de monitoreo (documentación ITIL / CSI / ISO)

El endpoint sirve como control de **disponibilidad del servicio**: un monitor externo
que registra el estado a lo largo del tiempo produce el histórico de uptime que
respalda los indicadores de mejora continua (CSI) y la gestión de disponibilidad (ITIL).

## Detalles técnicos

| Aspecto | Valor |
|---|---|
| Librería | `@nestjs/terminus` |
| Indicador | `MongooseHealthIndicator.pingCheck('mongodb', { timeout: 3000 })` |
| Ruta | `GET /api/health` (prefijo global `api`) |
| Autenticación | Ninguna (`@Public()`) |
| Módulo | `src/modules/health/` (`HealthModule`, `HealthController`) |
| Código de éxito | `200` |
| Código de fallo | `503` |

### Extensiones futuras (opcionales)

El array de checks admite más indicadores sin cambiar la ruta. Ejemplos:

```ts
this.health.check([
  () => this.mongoose.pingCheck('mongodb', { timeout: 3000 }),
  // Memoria del proceso (requiere MemoryHealthIndicator):
  // () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
  // Ping HTTP a un servicio externo (requiere HttpHealthIndicator):
  // () => this.http.pingCheck('cloudinary', 'https://res.cloudinary.com'),
]);
```

> Nota: por ahora solo se verifica MongoDB, que es la dependencia crítica del
> servicio. Firebase, Cloudinary y SMTP son opcionales y degradan con elegancia,
> así que no se incluyen como checks bloqueantes.
