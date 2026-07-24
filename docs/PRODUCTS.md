# Productos — Urban Blade API

Catálogo de productos de la **tienda** de la barbería (ceras, shampoos, aceites,
etc.). CRUD simple: **lectura pública**, **escritura solo admin**. Es un catálogo
informativo — no hay flujo de compra/venta ni descuento de stock automático.

## Enums

```ts
type ProductCategory = "shampoo" | "cera" | "aceite" | "crema" | "otro";
```

## Forma de un producto (respuesta)

Toda respuesta viene envuelta en `ApiResponse<T>`; lo de abajo es el `data`.

```ts
{
  _id: string;
  name: string;
  description: string;      // "" si no se puso
  price: number;           // ≥ 0
  stock: number;           // ≥ 0 (informativo; no se descuenta solo)
  image?: string;          // URL (Cloudinary); puede no venir
  brand: string;           // "" si no se puso
  category: ProductCategory;
  isActive: boolean;       // soft delete: los inactivos no se listan
  createdAt: string;
  updatedAt: string;
}
```

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/products` | público | Listar productos activos (orden alfabético) |
| `GET` | `/products/:id` | público | Obtener un producto por id |
| `POST` | `/products` | 👑 admin | Crear producto |
| `PATCH` | `/products/:id` | 👑 admin | Actualizar producto |
| `DELETE` | `/products/:id` | 👑 admin | Eliminar (soft delete) |

### Listar (público)

```ts
GET /products      → data: Product[]     // solo activos, ordenados por nombre (A→Z)
```

Devuelve un **array plano** (no paginado). Un producto con `isActive: false` no
aparece.

### Detalle (público)

```ts
GET /products/:id  → data: Product
//   Errores: 400 "El id proporcionado no es válido" (id malformado),
//            404 "Producto no encontrado" (no existe o está inactivo)
```

### Crear (admin)

```ts
POST /products     (admin)
{
  "name": string,            // requerido, mín. 2 caracteres
  "price": number,           // requerido, ≥ 0
  "category": ProductCategory,// requerido
  "description"?: string,
  "stock"?: number,          // entero ≥ 0 (default 0)
  "image"?: string,          // URL de Cloudinary (ver subida de imágenes)
  "brand"?: string
}
//   → data: Product (con _id, isActive:true, timestamps)
```

### Actualizar (admin)

```ts
PATCH /products/:id   (admin)
// Cualquier subconjunto de los campos de crear (todos opcionales):
{ "name"?, "price"?, "category"?, "description"?, "stock"?, "image"?, "brand"? }
//   → data: Product actualizado
//   404 si no existe o está inactivo.
```

### Eliminar (admin)

```ts
DELETE /products/:id  (admin)   → data: null    (HTTP 200)
```

Es **soft delete**: marca `isActive: false` (no borra el documento). El producto
deja de aparecer en `GET /products`.

## Imagen del producto (flujo de 2 pasos)

El endpoint de crear/editar **no recibe archivos** — espera la `image` como una
**URL** (string). Primero sube el archivo, luego guarda la url:

```ts
// 1) Subir a Cloudinary:
POST /uploads/image  (multipart/form-data, campo `file`, ?folder=products)
//   → data: { url, publicId }

// 2) Crear/editar con esa url:
POST /products  { ..., "image": "<url del paso 1>" }
```

(Ver la sección "Subida de imágenes" del prompt para el detalle en React Native.)

## Recomendación de UI

- **Tienda (cliente/público):** grid de productos con `image`, `name`, `brand`,
  `price` y `category`. Filtro por `category` en el cliente (el backend no filtra;
  trae todos y filtras en el front). Muestra `stock` como "disponible/agotado" si
  quieres (`stock > 0`).
- **Admin:** tabla con crear/editar/eliminar; formulario con los campos de arriba
  y subida de imagen en dos pasos. Tras cada mutación, invalida `["products"]`.

## Notas

- `GET /products` y `GET /products/:id` son **públicos** (no requieren token).
- No hay **paginación** ni **filtros de servidor** (el listado es pequeño; filtra
  en el cliente).
- `stock` es **informativo**: no se descuenta automáticamente (no hay carrito ni
  checkout). Si en el futuro se añade venta, habría que implementar ese flujo.
