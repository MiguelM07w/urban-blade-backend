import { Types } from 'mongoose';

/**
 * Referencia de Mongoose que puede venir como ObjectId, como string, o como
 * documento poblado (con `_id`).
 */
export type ObjectIdRef =
  Types.ObjectId | string | { _id: Types.ObjectId | string };

/**
 * Extrae el id (string) de una referencia que puede venir como ObjectId, como
 * string, o como documento poblado (con `_id`). Evita el clásico
 * "[object Object]" al hacer `.toString()` sobre un ref poblado.
 */
export function extractId(ref: ObjectIdRef): string {
  if (typeof ref === 'string') {
    return ref;
  }
  if (ref instanceof Types.ObjectId) {
    return ref.toString();
  }
  return ref._id.toString();
}
