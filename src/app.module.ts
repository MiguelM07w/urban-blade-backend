import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AdminModule } from './modules/admin/admin.module';
import { AIRecommendationModule } from './modules/ai-recommendation/ai-recommendation.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { ContactModule } from './modules/contact/contact.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { HealthModule } from './modules/health/health.module';
import { LandingModule } from './modules/landing/landing.module';
import { MailModule } from './modules/mail/mail.module';
import { BarbersModule } from './modules/barbers/barbers.module';
import { BarbershopConfigModule } from './modules/barbershop-config/barbershop-config.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { QueueModule } from './modules/queue/queue.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ServicesModule } from './modules/services/services.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { TrustScoreModule } from './modules/trust-score/trust-score.module';
import { UsersModule } from './modules/users/users.module';
import { WaitingListModule } from './modules/waiting-list/waiting-list.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodbUri'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60000),
          limit: config.get<number>('throttle.limit', 100),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    // Infraestructura global (push FCM + correo + auditoría)
    FirebaseModule,
    MailModule,
    AuditLogModule,
    // Módulos de negocio
    AuthModule,
    UsersModule,
    TrustScoreModule,
    ServicesModule,
    BarbersModule,
    AppointmentsModule,
    TicketsModule,
    NotificationsModule,
    LoyaltyModule,
    ReviewsModule,
    WaitingListModule,
    PaymentsModule,
    BarbershopConfigModule,
    ProductsModule,
    OrdersModule,
    PromotionsModule,
    AIRecommendationModule,
    ReportsModule,
    AdminModule,
    ChatModule,
    CloudinaryModule,
    ContactModule,
    GalleryModule,
    QueueModule,
    HealthModule,
    LandingModule,
  ],
  providers: [
    // Autenticación JWT global (las rutas @Public() se saltan el guard)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Control de roles global
    { provide: APP_GUARD, useClass: RolesGuard },
    // Rate limiting global
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
