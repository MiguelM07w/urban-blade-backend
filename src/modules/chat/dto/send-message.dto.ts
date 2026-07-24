import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { MessageType } from '../enums/message-type.enum';

export class SendMessageDto {
  @ApiProperty({ description: 'ID de la conversación' })
  @IsMongoId()
  conversation!: string;

  @ApiPropertyOptional({ enum: MessageType, default: MessageType.TEXT })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  // Contenido de texto: requerido salvo que sea un mensaje de imagen.
  @ApiPropertyOptional()
  @ValidateIf((o: SendMessageDto) => o.type !== MessageType.IMAGE)
  @IsString()
  content?: string;

  // URL de imagen: requerida cuando type = image.
  @ApiPropertyOptional()
  @ValidateIf((o: SendMessageDto) => o.type === MessageType.IMAGE)
  @IsUrl()
  imageUrl?: string;
}
