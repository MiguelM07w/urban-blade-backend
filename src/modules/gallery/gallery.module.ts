import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Hairstyle,
  HairstyleSchema,
} from '../ai-recommendation/schemas/hairstyle.schema';
import { Barber, BarberSchema } from '../barbers/schemas/barber.schema';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

/**
 * Galería de solo lectura: combina imágenes de cortes (Hairstyle) y fotos de
 * portafolios de barberos. Registra ambos modelos (comparten colección con sus
 * módulos por el nombre del modelo), sin duplicar datos.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Hairstyle.name, schema: HairstyleSchema },
      { name: Barber.name, schema: BarberSchema },
    ]),
  ],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
