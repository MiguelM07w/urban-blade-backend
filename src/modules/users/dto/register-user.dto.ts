import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO de autorregistro público (POST /users). No permite `role` ni
 * `authProvider`: el rol siempre será `client`. Para crear staff con rol, el
 * admin usa POST /admin/users.
 */
export class RegisterUserDto extends OmitType(CreateUserDto, [
  'role',
  'authProvider',
] as const) {}
