import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { Role } from '../common/enums';
import { AIRecommendationService } from '../modules/ai-recommendation/ai-recommendation.service';
import { HairstyleCategory } from '../modules/ai-recommendation/enums/hairstyle-category.enum';
import { BarbersService } from '../modules/barbers/barbers.service';
import { DayOfWeek } from '../modules/barbers/enums/day-of-week.enum';
import { BarbershopConfigService } from '../modules/barbershop-config/barbershop-config.service';
import { ProductCategory } from '../modules/products/enums/product-category.enum';
import { ProductsService } from '../modules/products/products.service';
import {
  PromotionType,
  TargetAudience,
} from '../modules/promotions/enums/promotion.enums';
import { PromotionsService } from '../modules/promotions/promotions.service';
import { ServiceCategory } from '../modules/services/enums/service-category.enum';
import { ServicesService } from '../modules/services/services.service';
import { FaceType, HairType } from '../modules/users/enums/user.enums';
import { UsersService } from '../modules/users/users.service';

/**
 * Script de seed para desarrollo. Puebla datos base (config de barbería,
 * servicios, hairstyles, productos, promociones, barberos y usuarios de
 * prueba) reutilizando los servicios reales de la aplicación —así respeta
 * toda la validación y la lógica de negocio.
 *
 * Es idempotente: cada bloque verifica si ya existen datos antes de crear,
 * de modo que se puede ejecutar varias veces sin duplicar.
 *
 * Uso: `pnpm seed`
 */

const DEFAULT_PASSWORD = 'Password123';

async function seed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const usersService = app.get(UsersService);
    const servicesService = app.get(ServicesService);
    const barbersService = app.get(BarbersService);
    const aiService = app.get(AIRecommendationService);
    const productsService = app.get(ProductsService);
    const promotionsService = app.get(PromotionsService);
    const configService = app.get(BarbershopConfigService);

    // ---- Configuración de la barbería ----
    await configService.update({
      name: 'Urban Blade',
      address: 'Avenida Central 123, San José',
      phone: '+506 2222 3333',
      email: 'contacto@urbanblade.com',
      coordinates: { lat: 9.9281, lng: -84.0907 },
      googleMapsUrl: 'https://maps.google.com/?q=9.9281,-84.0907',
      wazeUrl: 'https://waze.com/ul?ll=9.9281,-84.0907',
      socialMedia: {
        instagram: 'https://instagram.com/urbanblade',
        facebook: 'https://facebook.com/urbanblade',
        tiktok: 'https://tiktok.com/@urbanblade',
      },
      openingHours: [
        { dayOfWeek: 'lunes', startTime: '09:00', endTime: '19:00', isClosed: false },
        { dayOfWeek: 'martes', startTime: '09:00', endTime: '19:00', isClosed: false },
        { dayOfWeek: 'miercoles', startTime: '09:00', endTime: '19:00', isClosed: false },
        { dayOfWeek: 'jueves', startTime: '09:00', endTime: '19:00', isClosed: false },
        { dayOfWeek: 'viernes', startTime: '09:00', endTime: '20:00', isClosed: false },
        { dayOfWeek: 'sabado', startTime: '08:00', endTime: '18:00', isClosed: false },
        { dayOfWeek: 'domingo', startTime: '00:00', endTime: '00:00', isClosed: true },
      ],
      slotDuration: 30,
      cancellationWindowHours: 2,
      isOpen: true,
    });
    logger.log('Configuración de la barbería lista');

    // ---- Usuarios de prueba (uno por rol) ----
    const admin = await ensureUser(usersService, {
      name: 'Admin Urban Blade',
      email: 'admin@urbanblade.com',
      role: Role.ADMIN,
    });
    const barberUser = await ensureUser(usersService, {
      name: 'Carlos Barbero',
      email: 'barber@urbanblade.com',
      role: Role.BARBER,
    });
    const barberUser2 = await ensureUser(usersService, {
      name: 'Diego Navaja',
      email: 'barber2@urbanblade.com',
      role: Role.BARBER,
    });
    await ensureUser(usersService, {
      name: 'Cliente Demo',
      email: 'client@urbanblade.com',
      role: Role.CLIENT,
      hairType: HairType.ONDULADO,
      faceType: FaceType.OVALADO,
    });
    logger.log('Usuarios de prueba listos');

    // ---- Servicios ----
    const services = [
      { name: 'Corte clásico', description: 'Corte de cabello tradicional', price: 12, duration: 30, category: ServiceCategory.CORTE },
      { name: 'Fade', description: 'Degradado moderno', price: 15, duration: 40, category: ServiceCategory.CORTE },
      { name: 'Arreglo de barba', description: 'Perfilado y arreglo de barba', price: 8, duration: 20, category: ServiceCategory.BARBA },
      { name: 'Corte + barba', description: 'Combo completo', price: 18, duration: 50, category: ServiceCategory.COMBO, isMonthlyFeatured: true },
      { name: 'Tratamiento capilar', description: 'Hidratación y cuidado', price: 25, duration: 45, category: ServiceCategory.TRATAMIENTO },
    ];
    if ((await servicesService.findAll()).length === 0) {
      for (const s of services) {
        await servicesService.create(s);
      }
      logger.log(`${services.length} servicios creados`);
    } else {
      logger.log('Servicios ya existían, se omiten');
    }

    // ---- Hairstyles (catálogo del recomendador) ----
    const hairstyles = [
      { name: 'Fade texturizado', description: 'Fade con textura arriba', faceTypes: [FaceType.OVALADO, FaceType.CUADRADO], hairTypes: [HairType.LISO, HairType.ONDULADO], category: HairstyleCategory.FADE, isTrending: true },
      { name: 'Pompadour', description: 'Volumen clásico hacia atrás', faceTypes: [FaceType.REDONDO, FaceType.OVALADO], hairTypes: [HairType.LISO], category: HairstyleCategory.CLASICO },
      { name: 'Crop moderno', description: 'Corte corto con flequillo', faceTypes: [FaceType.RECTANGULAR, FaceType.OVALADO], hairTypes: [HairType.ONDULADO, HairType.RIZADO], category: HairstyleCategory.MODERNO, isTrending: true },
      { name: 'Buzz cut', description: 'Corte al ras', faceTypes: [FaceType.CUADRADO, FaceType.DIAMANTE], hairTypes: [HairType.LISO, HairType.MUY_RIZADO], category: HairstyleCategory.CLASICO },
      { name: 'Rizos definidos', description: 'Estilo para cabello rizado', faceTypes: [FaceType.CORAZON, FaceType.OVALADO], hairTypes: [HairType.RIZADO, HairType.MUY_RIZADO], category: HairstyleCategory.TEXTURIZADO },
    ];
    if ((await aiService.findAllHairstyles()).length === 0) {
      for (const h of hairstyles) {
        await aiService.createHairstyle(h);
      }
      logger.log(`${hairstyles.length} hairstyles creados`);
    } else {
      logger.log('Hairstyles ya existían, se omiten');
    }

    // ---- Productos ----
    const products = [
      { name: 'Cera mate', description: 'Fijación fuerte, acabado mate', price: 14, stock: 30, brand: 'UrbanCare', category: ProductCategory.CERA },
      { name: 'Shampoo fortificante', description: 'Cuidado diario', price: 11, stock: 40, brand: 'UrbanCare', category: ProductCategory.SHAMPOO },
      { name: 'Aceite para barba', description: 'Hidrata y suaviza', price: 16, stock: 25, brand: 'BeardKing', category: ProductCategory.ACEITE },
    ];
    if ((await productsService.findAll()).length === 0) {
      for (const p of products) {
        await productsService.create(p);
      }
      logger.log(`${products.length} productos creados`);
    } else {
      logger.log('Productos ya existían, se omiten');
    }

    // ---- Promociones ----
    if ((await promotionsService.findAllActive()).length === 0) {
      const now = new Date();
      const inAMonth = new Date(now);
      inAMonth.setMonth(inAMonth.getMonth() + 1);
      await promotionsService.create({
        title: '20% en tu primer corte',
        description: 'Descuento de bienvenida para nuevos clientes',
        type: PromotionType.DESCUENTO,
        discountValue: 20,
        startDate: now,
        endDate: inAMonth,
        targetAudience: TargetAudience.NUEVOS_CLIENTES,
      });
      logger.log('Promoción de bienvenida creada');
    } else {
      logger.log('Promociones ya existían, se omiten');
    }

    // ---- Perfiles de barbero ----
    const fullSchedule = [
      { dayOfWeek: DayOfWeek.LUNES, startTime: '09:00', endTime: '19:00', isAvailable: true },
      { dayOfWeek: DayOfWeek.MARTES, startTime: '09:00', endTime: '19:00', isAvailable: true },
      { dayOfWeek: DayOfWeek.MIERCOLES, startTime: '09:00', endTime: '19:00', isAvailable: true },
      { dayOfWeek: DayOfWeek.JUEVES, startTime: '09:00', endTime: '19:00', isAvailable: true },
      { dayOfWeek: DayOfWeek.VIERNES, startTime: '09:00', endTime: '20:00', isAvailable: true },
      { dayOfWeek: DayOfWeek.SABADO, startTime: '08:00', endTime: '18:00', isAvailable: true },
    ];
    const existingBarbers = await barbersService.findAll();
    const existingBarberUserIds = new Set(
      existingBarbers.map((b) =>
        (b.user as unknown as { _id?: { toString(): string } })._id?.toString() ??
        b.user.toString(),
      ),
    );

    if (!existingBarberUserIds.has(barberUser.id)) {
      const barber = await barbersService.create({
        user: barberUser.id,
        specialty: ['fade', 'barba'],
        experience: 6,
        bio: 'Especialista en fades y perfilado de barba.',
        schedule: fullSchedule,
      });
      await barbersService.setBarberOfTheDay(barber.id, true);
      logger.log('Barbero 1 creado y marcado como barbero del día');
    } else {
      logger.log('Barbero 1 ya existía, se omite');
    }

    if (!existingBarberUserIds.has(barberUser2.id)) {
      await barbersService.create({
        user: barberUser2.id,
        specialty: ['corte clásico', 'tratamiento'],
        experience: 4,
        bio: 'Corte clásico y tratamientos capilares.',
        schedule: fullSchedule,
      });
      logger.log('Barbero 2 creado');
    } else {
      logger.log('Barbero 2 ya existía, se omite');
    }

    logger.log('✅ Seed completado');
    logger.log(
      `Credenciales de prueba (password para todos: ${DEFAULT_PASSWORD}): ` +
        'admin@urbanblade.com / barber@urbanblade.com / client@urbanblade.com',
    );
    logger.log(`Admin id: ${admin.id}`);
  } catch (error) {
    logger.error(
      `Error durante el seed: ${(error as Error).message}`,
      (error as Error).stack,
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

/**
 * Crea el usuario si no existe (por email); si ya existe, lo devuelve. Así el
 * seed es idempotente.
 */
async function ensureUser(
  usersService: UsersService,
  data: {
    name: string;
    email: string;
    role: Role;
    hairType?: HairType;
    faceType?: FaceType;
  },
): Promise<{ id: string; email: string }> {
  const existing = await usersService.findByEmail(data.email);
  if (existing) {
    return { id: existing.id, email: existing.email };
  }
  const created = await usersService.create({
    name: data.name,
    email: data.email,
    password: DEFAULT_PASSWORD,
    role: data.role,
    hairType: data.hairType,
    faceType: data.faceType,
  });
  return { id: created.id, email: created.email };
}

void seed();
