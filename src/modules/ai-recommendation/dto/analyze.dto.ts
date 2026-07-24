import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { FaceType, HairType } from '../../users/enums/user.enums';

/**
 * Resultado del análisis on-device que envía el móvil. El backend solo usa
 * estos datos ya procesados para consultar cortes compatibles.
 */
export class AnalyzeDto {
  @ApiProperty({ enum: FaceType, description: 'Tipo de rostro detectado' })
  @IsEnum(FaceType)
  faceType!: FaceType;

  @ApiProperty({ enum: HairType, description: 'Tipo de cabello detectado' })
  @IsEnum(HairType)
  hairType!: HairType;

  @ApiPropertyOptional({ description: 'URL de la selfie en Cloudinary' })
  @IsOptional()
  @IsUrl()
  selfieUrl?: string;
}
