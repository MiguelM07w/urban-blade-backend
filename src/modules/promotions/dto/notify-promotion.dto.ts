import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * Solicita el envío de la notificación push de una promoción concreta.
 */
export class NotifyPromotionDto {
  @ApiProperty({ description: 'ID de la promoción a notificar' })
  @IsMongoId()
  promotionId!: string;
}
