import { Global, Module } from '@nestjs/common';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';

/**
 * Módulo global: cualquier módulo puede inyectar CloudinaryService para subir
 * imágenes (avatares, portafolios, fotos de reseñas, etc.) sin re-importarlo.
 */
@Global()
@Module({
  controllers: [CloudinaryController],
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
