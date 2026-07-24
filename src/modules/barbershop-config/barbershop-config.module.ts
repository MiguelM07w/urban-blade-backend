import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BarbershopConfigController } from './barbershop-config.controller';
import { BarbershopConfigService } from './barbershop-config.service';
import {
  BarbershopConfig,
  BarbershopConfigSchema,
} from './schemas/barbershop-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BarbershopConfig.name, schema: BarbershopConfigSchema },
    ]),
    // Para exponer /config/wait-time delegando en appointments.
    forwardRef(() => AppointmentsModule),
  ],
  controllers: [BarbershopConfigController],
  providers: [BarbershopConfigService],
  // Se exporta para que appointments pueda leer la ventana de cancelación,
  // slot duration, etc., como fuente única de verdad.
  exports: [BarbershopConfigService],
})
export class BarbershopConfigModule {}
