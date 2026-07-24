import { Module } from '@nestjs/common';
import { BarbersModule } from '../barbers/barbers.module';
import { ReportsModule } from '../reports/reports.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    // Admin orquesta funcionalidad de otros módulos; no tiene schemas propios.
    ReportsModule,
    UsersModule,
    BarbersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
