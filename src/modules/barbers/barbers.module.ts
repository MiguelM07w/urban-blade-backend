import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BarbersController } from './barbers.controller';
import { BarbersService } from './barbers.service';
import { Barber, BarberSchema } from './schemas/barber.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Barber.name, schema: BarberSchema }]),
    forwardRef(() => AppointmentsModule),
  ],
  controllers: [BarbersController],
  providers: [BarbersService],
  exports: [BarbersService, MongooseModule],
})
export class BarbersModule {}
