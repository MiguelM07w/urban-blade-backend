import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import type {
  TDocumentDefinitions,
  Content,
  TableCell,
} from 'pdfmake/interfaces';
import { ReportsService } from './reports.service';
import { ReportPeriod } from './dto/report-query.dto';

/**
 * Fuentes estándar de pdfmake (Helvetica embebida en el motor). Evita tener
 * que empaquetar archivos de fuente.
 */
const PDF_FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

@Injectable()
export class ReportsExportService {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Reúne todos los reportes en una sola estructura, reutilizada por ambos
   * exportadores.
   */
  private async collectAll(period: ReportPeriod): Promise<{
    income: Awaited<ReturnType<ReportsService['income']>>;
    appointments: Awaited<ReturnType<ReportsService['appointments']>>;
    clients: Awaited<ReturnType<ReportsService['clients']>>;
    barbers: Awaited<ReturnType<ReportsService['barbers']>>;
    peakHours: Awaited<ReturnType<ReportsService['peakHours']>>;
    services: Awaited<ReturnType<ReportsService['services']>>;
  }> {
    const [income, appointments, clients, barbers, peakHours, services] =
      await Promise.all([
        this.reportsService.income(period),
        this.reportsService.appointments(period),
        this.reportsService.clients(),
        this.reportsService.barbers(),
        this.reportsService.peakHours(),
        this.reportsService.services(),
      ]);
    return { income, appointments, clients, barbers, peakHours, services };
  }

  /**
   * PDF completo con una sección por reporte.
   */
  async fullPdf(period: ReportPeriod): Promise<Buffer> {
    const data = await this.collectAll(period);

    const content: Content[] = [
      { text: 'Reporte general - Urban Blade', style: 'header' },
      { text: `Periodo: ${period}`, margin: [0, 0, 0, 12] },

      this.section('Ingresos', ['Periodo', 'Total', 'Tickets'], [
        ...data.income.map((r) => [r.period, r.total.toString(), r.count.toString()]),
      ]),

      this.section(
        'Citas (completadas vs canceladas)',
        ['Periodo', 'Completadas', 'Canceladas', 'Total'],
        data.appointments.map((r) => [
          r.period,
          r.completadas.toString(),
          r.canceladas.toString(),
          r.total.toString(),
        ]),
      ),

      this.section('Clientes', ['Nuevos', 'Recurrentes'], [
        [data.clients.nuevos.toString(), data.clients.recurrentes.toString()],
      ]),

      this.section(
        'Ranking de barberos',
        ['Barbero', 'Rating', 'Completadas'],
        data.barbers.map((r) => [
          r.barber,
          r.rating.toString(),
          r.completadas.toString(),
        ]),
      ),

      this.section('Horas pico', ['Hora', 'Citas'], [
        ...data.peakHours.map((r) => [r.hour, r.count.toString()]),
      ]),

      this.section('Servicios más populares', ['Servicio', 'Tickets'], [
        ...data.services.map((r) => [r.service, r.count.toString()]),
      ]),
    ];

    const docDefinition: TDocumentDefinitions = {
      defaultStyle: { font: 'Helvetica', fontSize: 9 },
      content,
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        sectionTitle: { fontSize: 13, bold: true, margin: [0, 12, 0, 6] },
      },
    };

    return this.buildPdf(docDefinition);
  }

  /**
   * Excel completo con una hoja por reporte.
   */
  async fullExcel(period: ReportPeriod): Promise<Buffer> {
    const data = await this.collectAll(period);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Urban Blade';

    this.addSheet(
      workbook,
      'Ingresos',
      [
        { header: 'Periodo', key: 'period', width: 20 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Tickets', key: 'count', width: 15 },
      ],
      data.income,
    );

    this.addSheet(
      workbook,
      'Citas',
      [
        { header: 'Periodo', key: 'period', width: 20 },
        { header: 'Completadas', key: 'completadas', width: 15 },
        { header: 'Canceladas', key: 'canceladas', width: 15 },
        { header: 'Total', key: 'total', width: 12 },
      ],
      data.appointments,
    );

    this.addSheet(
      workbook,
      'Clientes',
      [
        { header: 'Nuevos', key: 'nuevos', width: 15 },
        { header: 'Recurrentes', key: 'recurrentes', width: 15 },
      ],
      [data.clients],
    );

    this.addSheet(
      workbook,
      'Barberos',
      [
        { header: 'Barbero', key: 'barber', width: 28 },
        { header: 'Rating', key: 'rating', width: 12 },
        { header: 'Completadas', key: 'completadas', width: 15 },
      ],
      data.barbers,
    );

    this.addSheet(
      workbook,
      'Horas pico',
      [
        { header: 'Hora', key: 'hour', width: 12 },
        { header: 'Citas', key: 'count', width: 12 },
      ],
      data.peakHours,
    );

    this.addSheet(
      workbook,
      'Servicios',
      [
        { header: 'Servicio', key: 'service', width: 28 },
        { header: 'Tickets', key: 'count', width: 12 },
      ],
      data.services,
    );

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Construye una sección del PDF: título + tabla con cabecera.
   */
  private section(
    title: string,
    headers: string[],
    rows: TableCell[][],
  ): Content {
    return {
      stack: [
        { text: title, style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: headers.map(() => '*'),
            body: [
              headers.map((h) => ({ text: h, bold: true })),
              ...(rows.length > 0
                ? rows
                : [headers.map(() => '—')]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
    };
  }

  /**
   * Añade una hoja al workbook con cabecera en negrita.
   */
  private addSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    columns: Array<Partial<ExcelJS.Column>>,
    rows: Array<Record<string, unknown>>,
  ): void {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
  }

  /**
   * Renderiza un documento pdfmake a Buffer resolviendo el stream.
   */
  private buildPdf(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    const printer = new PdfPrinter(PDF_FONTS);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
