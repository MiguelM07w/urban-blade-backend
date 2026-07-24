import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Extrae el usuario autenticado (inyectado por JwtStrategy) de la request.
 * Uso: `@CurrentUser() user: AuthenticatedUser`
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
