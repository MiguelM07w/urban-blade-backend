import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class AddPortfolioDto {
  @ApiProperty({ description: 'URL de la imagen (Cloudinary)' })
  @IsUrl()
  imageUrl!: string;
}
