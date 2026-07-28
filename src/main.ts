import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  // rawBody: true preserva el cuerpo sin parsear (necesario para verificar la
  // firma del webhook de Stripe).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);

  const apiPrefix = config.get<string>('apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Respuestas estandarizadas + manejo global de errores
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Urban Blade API')
    .setDescription('API backend para la barbería Urban Blade')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = config.get<number>('port', 3000);
  // Escuchar en 0.0.0.0 (no solo localhost) es obligatorio en plataformas como
  // Render/Railway: enrutan el tráfico a la app por su IP interna, no por
  // localhost. Sin esto el health check falla y el deploy se marca como caído.
  await app.listen(port, '0.0.0.0');

  console.log(
    `🚀 Urban Blade API corriendo en el puerto ${port} (/${apiPrefix})`,
  );
}

void bootstrap();
