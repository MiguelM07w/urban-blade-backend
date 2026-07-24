import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { TrustScoreService } from '../../modules/trust-score/trust-score.service';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Bloquea la creación de reservas cuando el trust score del usuario es < 40
 * o cuando el usuario está temporalmente restringido.
 */
@Injectable()
export class TrustScoreGuard implements CanActivate {
  constructor(private readonly trustScoreService: TrustScoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const canBook = await this.trustScoreService.canBook(user.userId);
    if (!canBook) {
      throw new ForbiddenException(
        'Tu trust score es demasiado bajo o estás restringido para reservar citas',
      );
    }

    return true;
  }
}
