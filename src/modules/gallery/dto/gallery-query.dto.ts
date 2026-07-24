import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { HairstyleCategory } from '../../ai-recommendation/enums/hairstyle-category.enum';
import { FaceType, HairType } from '../../users/enums/user.enums';
import { GalleryItemType } from '../enums/gallery-item-type.enum';

export class GalleryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: GalleryItemType,
    description: 'Filtrar por origen del item',
  })
  @IsOptional()
  @IsEnum(GalleryItemType)
  type?: GalleryItemType;

  @ApiPropertyOptional({
    enum: FaceType,
    description: 'Cortes recomendados para este tipo de rostro',
  })
  @IsOptional()
  @IsEnum(FaceType)
  faceType?: FaceType;

  @ApiPropertyOptional({
    enum: HairType,
    description: 'Cortes compatibles con este tipo de cabello',
  })
  @IsOptional()
  @IsEnum(HairType)
  hairType?: HairType;

  @ApiPropertyOptional({ enum: HairstyleCategory })
  @IsOptional()
  @IsEnum(HairstyleCategory)
  category?: HairstyleCategory;

  @ApiPropertyOptional({ description: 'Id del barbero (solo trabajos suyos)' })
  @IsOptional()
  @IsMongoId()
  barber?: string;

  @ApiPropertyOptional({ description: 'Solo cortes en tendencia' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  trending?: boolean;
}
