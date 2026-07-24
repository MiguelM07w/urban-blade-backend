import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * Valida que un parámetro de ruta `:id` sea un ObjectId de Mongo válido.
 */
export class MongoIdParam {
  @ApiProperty({ description: 'ObjectId de MongoDB' })
  @IsMongoId()
  id!: string;
}
