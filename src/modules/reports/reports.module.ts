import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Appointment,
  AppointmentSchema,
} from '../appointments/schemas/appointment.schema';
import { Barber, BarberSchema } from '../barbers/schemas/barber.schema';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ReportsExportService } from './reports-export.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    // Reports es de solo lectura: registra los modelos que necesita para
    // agregaciones. Comparten colección con sus módulos por el nombre del
    // modelo.
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: User.name, schema: UserSchema },
      { name: Barber.name, schema: BarberSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExportService],
  exports: [ReportsService],
})
export class ReportsModule {}
