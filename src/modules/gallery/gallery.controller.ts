import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import { GalleryService } from './gallery.service';

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary:
      'Galería pública de cortes y trabajos de barberos, filtrable y paginada',
  })
  find(@Query() query: GalleryQueryDto) {
    return this.galleryService.find(query);
  }
}
