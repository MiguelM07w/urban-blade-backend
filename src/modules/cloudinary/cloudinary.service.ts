import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { v2 as Cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { CLOUDINARY } from './cloudinary.provider';

@Injectable()
export class CloudinaryService {
  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof Cloudinary,
  ) {}

  /**
   * Sube un archivo (buffer de multer) a Cloudinary mediante un stream de
   * subida. Devuelve la respuesta de Cloudinary (incluye secure_url).
   *
   * @param file    Archivo recibido por multer (memoria).
   * @param folder  Carpeta de destino en Cloudinary (p. ej. 'avatars').
   */
  uploadImage(
    file: Express.Multer.File,
    folder = 'urban-blade',
  ): Promise<UploadApiResponse> {
    if (!file?.buffer) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                `Error al subir la imagen: ${error?.message ?? 'desconocido'}`,
              ),
            );
            return;
          }
          resolve(result);
        },
      );

      // Convierte el buffer en un stream legible y lo canaliza al upload.
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Elimina una imagen por su public_id.
   */
  async deleteImage(publicId: string): Promise<void> {
    await this.cloudinary.uploader.destroy(publicId);
  }
}
