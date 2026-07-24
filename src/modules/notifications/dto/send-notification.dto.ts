import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * DTO para el envío manual de una notificación a un usuario concreto (admin).
 */
export class SendNotificationDto {
  @ApiProperty({ description: 'ID del usuario destinatario' })
  @IsMongoId()
  user!: string;

  @ApiProperty({ example: 'Tu cita fue confirmada' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: 'Te esperamos mañana a las 15:00' })
  @IsString()
  body!: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiPropertyOptional({ description: 'Payload extra opcional' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
