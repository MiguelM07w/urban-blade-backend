import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Actualización de perfil. No se permite cambiar email/password/role por aquí
 * (email es identidad, password tiene su propio flujo, role lo gestiona admin).
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password', 'role'] as const),
) {}
