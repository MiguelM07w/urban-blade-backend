import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Servicio creado')
  @ApiOperation({ summary: 'Crear servicio (admin)' })
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar servicios activos' })
  findAll() {
    return this.servicesService.findAll();
  }

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Obtener servicio/corte del mes' })
  findFeatured() {
    return this.servicesService.findFeatured();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener servicio por ID' })
  findOne(@Param('id') id: string) {
    return this.servicesService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Audit(AuditAction.SERVICE_UPDATED)
  @ResponseMessage('Servicio actualizado')
  @ApiOperation({ summary: 'Actualizar servicio (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Patch(':id/featured')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Corte del mes actualizado')
  @ApiOperation({ summary: 'Marcar como corte del mes (admin)' })
  setFeatured(@Param('id') id: string) {
    return this.servicesService.setFeatured(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Servicio eliminado')
  @ApiOperation({ summary: 'Eliminar servicio (admin)' })
  async remove(@Param('id') id: string) {
    await this.servicesService.remove(id);
    return null;
  }
}
