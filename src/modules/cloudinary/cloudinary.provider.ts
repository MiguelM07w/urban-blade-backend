import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Token de inyección del SDK de Cloudinary ya configurado.
 */
export const CLOUDINARY = 'CLOUDINARY';

/**
 * Provider que configura el SDK global de Cloudinary con las credenciales de
 * entorno. Si faltan credenciales, el SDK queda sin configurar y los uploads
 * fallarán con un error claro en tiempo de ejecución (no en el arranque).
 */
export const CloudinaryProvider = {
  provide: CLOUDINARY,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): typeof cloudinary => {
    cloudinary.config({
      cloud_name: configService.get<string>('cloudinary.cloudName'),
      api_key: configService.get<string>('cloudinary.apiKey'),
      api_secret: configService.get<string>('cloudinary.apiSecret'),
    });
    return cloudinary;
  },
};
