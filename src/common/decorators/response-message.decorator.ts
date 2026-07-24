import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'responseMessage';

/**
 * Personaliza el campo `message` de la respuesta estándar.
 */
export const ResponseMessage = (message: string): CustomDecorator<string> =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
