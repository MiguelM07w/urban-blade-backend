import { Injectable } from '@nestjs/common';
import { Role } from '../../common/enums';
import { BarbersService } from '../barbers/barbers.service';
import { ReportPeriod } from '../reports/dto/report-query.dto';
import { ReportsService } from '../reports/reports.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService,
    private readonly barbersService: BarbersService,
  ) {}

  /**
   * Panel de control: consolida las métricas clave de la barbería en una sola
   * respuesta reutilizando el módulo de reports.
   */
  async dashboard(): Promise<{
    income: Awaited<ReturnType<ReportsService['income']>>;
    appointments: Awaited<ReturnType<ReportsService['appointments']>>;
    clients: Awaited<ReturnType<ReportsService['clients']>>;
    topBarbers: Awaited<ReturnType<ReportsService['barbers']>>;
    peakHours: Awaited<ReturnType<ReportsService['peakHours']>>;
  }> {
    const [income, appointments, clients, topBarbers, peakHours] =
      await Promise.all([
        this.reportsService.income(ReportPeriod.MONTHLY),
        this.reportsService.appointments(ReportPeriod.MONTHLY),
        this.reportsService.clients(),
        this.reportsService.barbers(),
        this.reportsService.peakHours(),
      ]);

    return {
      income,
      appointments,
      clients,
      // Solo el top 5 de barberos para el panel.
      topBarbers: topBarbers.slice(0, 5),
      peakHours: peakHours.slice(0, 5),
    };
  }

  /**
   * Crea un usuario desde el panel admin, con el rol indicado. Si el rol es
   * `barber`, crea también su perfil de barbero para que aparezca en /barbers.
   */
  async createUser(dto: CreateUserDto): Promise<UserDocument> {
    const user = await this.usersService.create(dto);
    if (user.role === Role.BARBER) {
      await this.barbersService.ensureProfileForUser(user.id);
    }
    return user;
  }

  /**
   * Bloquea a un usuario. Si no se pasa fecha, el bloqueo es permanente.
   */
  async blockUser(userId: string, blockedUntil?: Date): Promise<UserDocument> {
    await this.usersService.block(userId, blockedUntil ?? null);
    return this.usersService.findById(userId);
  }

  /**
   * Desbloquea a un usuario.
   */
  async unblockUser(userId: string): Promise<UserDocument> {
    await this.usersService.unblock(userId);
    return this.usersService.findById(userId);
  }

  /**
   * Cambia el rol de un usuario y sincroniza su perfil de barbero:
   * - Al pasar a `barber`: crea (o reactiva) su documento Barber para que
   *   aparezca en /barbers, pueda recibir citas y chatear.
   * - Al salir de `barber`: desactiva su documento Barber si lo tenía.
   */
  async changeRole(userId: string, role: Role): Promise<UserDocument> {
    const user = await this.usersService.changeRole(userId, role);
    if (role === Role.BARBER) {
      await this.barbersService.ensureProfileForUser(userId);
    } else {
      await this.barbersService.deactivateForUser(userId);
    }
    return user;
  }
}
