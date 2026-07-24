import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsExportService } from './reports-export.service';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ReportsExportService,
  ) {}

  @Get('income')
  @ApiOperation({ summary: 'Ingresos (daily/weekly/monthly)' })
  income(@Query() query: ReportQueryDto) {
    return this.reportsService.income(query.period);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Citas completadas vs canceladas por periodo' })
  appointments(@Query() query: ReportQueryDto) {
    return this.reportsService.appointments(query.period);
  }

  @Get('clients')
  @ApiOperation({ summary: 'Clientes nuevos vs recurrentes' })
  clients() {
    return this.reportsService.clients();
  }

  @Get('barbers')
  @ApiOperation({ summary: 'Ranking de barberos por calificación y citas' })
  barbers() {
    return this.reportsService.barbers();
  }

  @Get('peak-hours')
  @ApiOperation({ summary: 'Horarios más concurridos' })
  peakHours() {
    return this.reportsService.peakHours();
  }

  @Get('services')
  @ApiOperation({ summary: 'Servicio más popular' })
  services() {
    return this.reportsService.services();
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Exportar reporte general en PDF' })
  async exportPdf(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportService.fullPdf(query.period);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="reporte-urban-blade.pdf"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'Exportar reporte general en Excel (xlsx)' })
  async exportExcel(
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportService.fullExcel(query.period);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="reporte-urban-blade.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
