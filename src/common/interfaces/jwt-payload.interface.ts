import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/**
 * Usuario autenticado adjuntado a la request por la JwtStrategy.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}
