import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  @ResponseMessage('Mensaje enviado. Te contactaremos pronto.')
  @ApiOperation({ summary: 'Enviar mensaje de contacto (público)' })
  create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar mensajes de contacto (admin)' })
  findAll() {
    return this.contactService.findAll();
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Mensaje marcado como leído')
  @ApiOperation({ summary: 'Marcar mensaje como leído (admin)' })
  markAsRead(@Param('id') id: string) {
    return this.contactService.markAsRead(id);
  }
}
