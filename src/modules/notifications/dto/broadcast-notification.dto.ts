import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * DTO para difundir una notificación a todos los usuarios activos (admin).
 * No lleva destinatario: el servicio la crea para cada usuario.
 */
export class BroadcastNotificationDto {
  @ApiProperty({ example: '¡Nueva promoción!' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: '20% de descuento en cortes toda la semana' })
  @IsString()
  body!: string;

  @ApiProperty({ enum: NotificationType, default: NotificationType.PROMOCION })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiPropertyOptional({ description: 'Payload extra opcional' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
