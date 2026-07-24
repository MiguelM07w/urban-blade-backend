import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

/**
 * Guard de autenticación para gateways WebSocket. Valida el access token del
 * handshake y adjunta el usuario autenticado en `socket.data.user`.
 *
 * El token puede venir en `handshake.auth.token` (recomendado en Socket.io)
 * o en el header `Authorization: Bearer <token>`.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const user = await this.authenticate(client);
    // Se cachea en el socket para que los handlers lo reutilicen.
    client.data.user = user;
    return true;
  }

  /**
   * Extrae y verifica el token del socket. Lanza WsException si es inválido.
   * Expuesto para poder autenticar también en handleConnection.
   */
  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Token de autenticación ausente');
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new WsException('Token inválido o expirado');
    }
  }

  private extractToken(client: Socket): string | null {
    // 1) handshake.auth.token (forma idiomática de socket.io-client).
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }
    // 2) Header Authorization.
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.length > 0) {
      return header.replace(/^Bearer\s+/i, '');
    }
    return null;
  }
}
