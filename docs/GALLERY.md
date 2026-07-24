# Galería — Urban Blade API

Feed **público** que combina, en una sola respuesta filtrable, las imágenes de
**cortes del catálogo** (`Hairstyle`) y las **fotos reales de los portafolios de
los barberos** (`Barber.portfolio`). No duplica datos: **lee** de las colecciones
existentes y arma el feed al vuelo.

## Endpoint

```
GET /api/gallery      (público)
```

Devuelve **un item por imagen**, paginado y con filtros. Ideal para la pantalla
"Galería de trabajos" y para el flujo de recomendación ("cortes para rostro
cuadrado").

### Query params (todos opcionales)

| Param | Valores | Efecto |
|---|---|---|
| `type` | `hairstyle` \| `barber_work` | Filtra por origen del item |
| `faceType` | `ovalado`, `redondo`, `cuadrado`, `rectangular`, `diamante`, `corazon` | Cortes recomendados para ese rostro |
| `hairType` | `liso`, `ondulado`, `rizado`, `muy_rizado` | Cortes compatibles con ese cabello |
| `category` | categoría de hairstyle | Filtra cortes por categoría |
| `barber` | id de barbero | Solo trabajos de ese barbero |
| `trending` | `true` \| `false` | Solo cortes en tendencia |
| `page` / `limit` | número | Paginación (default 1 / 20, máx 100) |

> **Nota:** `faceType`, `hairType`, `category` y `trending` son propiedades de los
> **cortes**, no de los trabajos de barbero. Si filtras por cualquiera de ellos,
> el feed devuelve **solo hairstyles** (los trabajos de barbero no aplican).

### Respuesta (`data`)

```jsonc
{
  "items": [
    {
      "type": "hairstyle",                 // o "barber_work"
      "imageUrl": "https://res.cloudinary.com/.../fade.jpg",
      "title": "Fade texturizado",         // nombre del corte, o "Trabajo de <barbero>"
      "category": "fade",                  // null en barber_work
      "faceTypes": ["ovalado", "cuadrado"],// [] en barber_work
      "hairTypes": ["liso", "ondulado"],   // [] en barber_work
      "isTrending": true,                  // false en barber_work
      "barberId": null,                    // el id del barbero en barber_work
      "barberName": null                   // el nombre del barbero en barber_work
    }
  ],
  "total": 12, "page": 1, "limit": 20
}
```

Los items en tendencia se ordenan primero. Cada objeto tiene la misma forma sin
importar el origen (los campos no aplicables van `null`/`[]`), para que el front
lo pinte de forma uniforme.

## Casos de uso

### 1. Galería general de trabajos

```
GET /api/gallery?page=1&limit=20
```
Feed mixto de cortes del catálogo + trabajos reales de los barberos.

### 2. "Cortes recomendados para tu rostro" (junto al análisis de IA)

Tras `POST /ai/analyze` (que detecta `faceType`/`hairType` on-device), muestra la
galería de cortes compatibles:

```
GET /api/gallery?faceType=cuadrado&hairType=liso&type=hairstyle
```

### 3. Portafolio de un barbero concreto

```
GET /api/gallery?type=barber_work&barber=<barberId>
```
Equivale a los trabajos de ese barbero (también disponibles en
`GET /barbers/:id/portfolio`, pero aquí con la forma unificada del feed).

## De dónde salen las imágenes

- **`hairstyle`:** del campo `images[]` de cada `Hairstyle` (se sube con
  `PATCH /ai/hairstyles/:id`). Un hairstyle sin imágenes no aparece en el feed.
- **`barber_work`:** del campo `portfolio[]` de cada `Barber` (se sube/borra con
  `POST` / `DELETE /barbers/:id/portfolio`).

> Si el feed sale vacío para `type=hairstyle`, es porque los cortes del catálogo
> aún no tienen imágenes cargadas — no es un error. En cuanto el admin suba
> imágenes a los hairstyles, aparecen automáticamente.

## Detalles técnicos

| Aspecto | Valor |
|---|---|
| Módulo | `src/modules/gallery/` (solo lectura) |
| Endpoint | `GET /gallery` (`@Public()`) |
| Fuentes | `Hairstyle.images[]` + `Barber.portfolio[]` |
| Duplica datos | No (lee de las colecciones existentes) |

El módulo registra los modelos `Hairstyle` y `Barber` con `forFeature` (comparten
colección con sus módulos por el nombre del modelo, igual que `reports`), sin
escribir nada: es un agregador de solo lectura.
