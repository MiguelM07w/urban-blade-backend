import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { AuthProvider, Role } from '../../common/enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { MailService } from '../mail/mail.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    avatar?: string;
  };
}

const RESET_TOKEN_PURPOSE = 'password_reset';
const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('google.clientId'),
    );
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      phone: dto.phone,
      authProvider: AuthProvider.EMAIL,
      role: Role.CLIENT,
    });
    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta está desactivada');
    }
    this.assertNotBlocked(user);

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.buildAuthResult(user);
  }

  async loginWithGoogle(dto: GoogleLoginDto): Promise<AuthResult> {
    const clientId = this.configService.get<string>('google.clientId');
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new UnauthorizedException('Token de Google inválido');
    }

    let user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      user = await this.usersService.createOAuthUser({
        name: payload.name ?? payload.email,
        email: payload.email,
        avatar: payload.picture,
        authProvider: AuthProvider.GOOGLE,
      });
    }
    this.assertNotBlocked(user);
    return this.buildAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Sesión no válida');
    }
    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException('Refresh token no reconocido');
    }
    this.assertNotBlocked(user);

    return this.buildAuthResult(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setHashedRefreshToken(userId, null);
  }

  /**
   * Genera un token de recuperación de contraseña (JWT de corta duración) y lo
   * envía por correo. Si SMTP no está configurado (desarrollo), se devuelve el
   * token en la respuesta como respaldo para poder probar el flujo; con SMTP
   * activo, el token viaja por email y la respuesta NO lo expone.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ resetToken: string | null }> {
    const user = await this.usersService.findByEmail(dto.email);
    // No revelamos si el email existe.
    if (!user) {
      return { resetToken: null };
    }
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: RESET_TOKEN_PURPOSE },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: '30m',
      },
    );

    const sent = await this.sendResetEmail(user.email, user.name, resetToken);
    this.logger.log(
      `Token de recuperación generado para ${dto.email} (email enviado: ${sent})`,
    );

    // Solo se expone el token si no pudo enviarse por correo (SMTP off = dev).
    return { resetToken: sent ? null : resetToken };
  }

  /**
   * Construye y envía el correo de recuperación con el enlace de reseteo.
   * Devuelve true si el correo salió por SMTP.
   */
  private async sendResetEmail(
    to: string,
    name: string,
    resetToken: string,
  ): Promise<boolean> {
    const base = this.configService.get<string>('mail.resetUrlBase') ?? '';
    // Si hay base configurada, se arma un enlace; si no, se muestra el token.
    const resetLink = base
      ? `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(resetToken)}`
      : null;

    const subject = 'Recuperación de contraseña — Urban Blade';
    const action = resetLink
      ? `<p>Para restablecer tu contraseña, abre este enlace (válido 30 minutos):</p>
         <p><a href="${resetLink}">Restablecer contraseña</a></p>
         <p>Si el botón no funciona, copia este enlace:<br>${resetLink}</p>`
      : `<p>Usa este código para restablecer tu contraseña (válido 30 minutos):</p>
         <p style="font-family:monospace;word-break:break-all">${resetToken}</p>`;

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Urban Blade</h2>
        <p>Hola ${name},</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
        ${action}
        <p>Si no fuiste tú, ignora este correo; tu contraseña no cambiará.</p>
      </div>`;
    const text = resetLink
      ? `Restablece tu contraseña (válido 30 min): ${resetLink}`
      : `Código para restablecer tu contraseña (válido 30 min): ${resetToken}`;

    return this.mailService.send(to, subject, html, text);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    let payload: { sub: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException(
        'Token de recuperación inválido o expirado',
      );
    }
    if (payload.purpose !== RESET_TOKEN_PURPOSE) {
      throw new UnauthorizedException('Token de recuperación inválido');
    }
    await this.usersService.updatePassword(payload.sub, dto.newPassword);
    // Invalida sesiones activas.
    await this.usersService.setHashedRefreshToken(payload.sub, null);
  }

  private assertNotBlocked(user: UserDocument): void {
    if (user.isBlocked) {
      if (!user.blockedUntil || user.blockedUntil.getTime() > Date.now()) {
        throw new ForbiddenException(
          'Tu cuenta está bloqueada. Contacta con la barbería.',
        );
      }
    }
  }

  private async buildAuthResult(user: UserDocument): Promise<AuthResult> {
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const hashedRefreshToken = await bcrypt.hash(
      tokens.refreshToken,
      SALT_ROUNDS,
    );
    await this.usersService.setHashedRefreshToken(
      user.id,
      hashedRefreshToken,
      this.refreshTokenExpiry(),
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessOptions = {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
    } as JwtSignOptions;
    const refreshOptions = {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
    } as JwtSignOptions;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, accessOptions),
      this.jwtService.signAsync(payload, refreshOptions),
    ]);
    return { accessToken, refreshToken };
  }

  /**
   * Calcula la fecha de expiración del refresh token a partir de la duración
   * configurada (`jwt.refreshExpiresIn`, p. ej. "7d"), para persistirla y poder
   * limpiar por cron los tokens ya expirados. Coincide con la vida real del JWT.
   */
  private refreshTokenExpiry(): Date {
    const expiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );
    return new Date(Date.now() + this.durationToMs(expiresIn));
  }

  /**
   * Convierte una duración estilo JWT ("7d", "15m", "3600s", o segundos como
   * número) a milisegundos. Respaldo: 7 días.
   */
  private durationToMs(value: string): number {
    const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const amount = parseInt(match[1], 10);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[unit];
  }
}
