import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../../common/enums';

export class ChangeRoleDto {
  @ApiProperty({ enum: Role, description: 'Nuevo rol del usuario' })
  @IsEnum(Role)
  role!: Role;
}
