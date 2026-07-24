import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta como pública, saltándose el JwtAuthGuard global.
 */
export const Public = (): CustomDecorator<string> =>
  SetMetadata(IS_PUBLIC_KEY, true);
