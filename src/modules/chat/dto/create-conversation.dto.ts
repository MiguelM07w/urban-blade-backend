import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsMongoId, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    type: [String],
    description: 'IDs de los participantes (al menos 2)',
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsMongoId({ each: true })
  participants!: string[];

  @ApiPropertyOptional({ description: 'ID de la cita asociada (opcional)' })
  @IsOptional()
  @IsMongoId()
  appointment?: string;
}
