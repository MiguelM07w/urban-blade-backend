import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
}

/**
 * Manejo global de errores. Devuelve el mismo formato estándar de respuesta
 * que el ResponseInterceptor, pero con success = false.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as HttpExceptionBody;
        if (Array.isArray(body.message)) {
          message = body.message.join(', ');
        } else if (typeof body.message === 'string') {
          message = body.message;
        } else if (body.error) {
          message = body.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiResponse<null> = {
      success: false,
      data: null,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}
