import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ResponseMessage('Registro exitoso')
  @ApiOperation({ summary: 'Registro con email/password' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @Audit(AuditAction.LOGIN_SUCCESS)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login exitoso')
  @ApiOperation({ summary: 'Login con email/password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login con Google exitoso')
  @ApiOperation({ summary: 'Login con Google (OAuth2)' })
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  @Post('apple')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con Apple (pendiente de implementar)' })
  apple() {
    throw new NotImplementedException(
      'Login con Apple aún no está implementado',
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Token renovado')
  @ApiOperation({ summary: 'Renovar access token con refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Sesión cerrada')
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@CurrentUser('userId') userId: string) {
    await this.authService.logout(userId);
    return null;
  }

  @Post('forgot-password')
  @Public()
  @Audit(AuditAction.PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Si el email existe, se envió un código de recuperación')
  @ApiOperation({
    summary: 'Solicitar recuperación de contraseña (envía código)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Código verificado')
  @ApiOperation({
    summary: 'Verificar el código de recuperación (sin cambiar la contraseña)',
  })
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('reset-password')
  @Public()
  @Audit(AuditAction.PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Contraseña actualizada')
  @ApiOperation({ summary: 'Resetear contraseña con código+email o token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return null;
  }
}
