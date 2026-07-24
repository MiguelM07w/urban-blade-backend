import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { PaymentStatus } from './enums/ticket.enums';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ResponseMessage('Ticket generado')
  @ApiOperation({
    summary: 'Generar ticket (normalmente interno, al completar cita)',
  })
  create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Listar tickets (admin). Con ?paymentStatus=pendiente = cola de cobro',
  })
  @ApiQuery({ name: 'paymentStatus', enum: PaymentStatus, required: false })
  findAll(@Query('paymentStatus') paymentStatus?: PaymentStatus) {
    if (
      paymentStatus !== undefined &&
      !Object.values(PaymentStatus).includes(paymentStatus)
    ) {
      throw new BadRequestException('paymentStatus no válido');
    }
    return this.ticketsService.findAll(paymentStatus);
  }

  @Get('client/:clientId')
  @ApiOperation({ summary: 'Tickets del cliente' })
  findByClient(@Param('clientId') clientId: string) {
    return this.ticketsService.findByClient(clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener ticket por ID' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Obtener datos del recibo digital' })
  getReceipt(@Param('id') id: string) {
    // NOTA: la generación del PDF (pdfmake) queda como siguiente iteración.
    // Por ahora se devuelven los datos estructurados del recibo.
    return this.ticketsService.findById(id);
  }
}
