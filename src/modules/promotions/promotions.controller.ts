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
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { NotifyPromotionDto } from './dto/notify-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Audit(AuditAction.PROMOTION_CREATED)
  @ResponseMessage('Promoción creada')
  @ApiOperation({ summary: 'Crear promoción (admin)' })
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar promociones activas' })
  findAll() {
    return this.promotionsService.findAllActive();
  }

  @Post('notify')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Promoción notificada')
  @ApiOperation({ summary: 'Enviar notificación push de promoción a usuarios' })
  notify(@Body() dto: NotifyPromotionDto) {
    return this.promotionsService.notify(dto.promotionId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener promoción por ID' })
  findOne(@Param('id') id: string) {
    return this.promotionsService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Promoción actualizada')
  @ApiOperation({ summary: 'Actualizar promoción (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Promoción eliminada')
  @ApiOperation({ summary: 'Eliminar promoción (admin)' })
  async remove(@Param('id') id: string) {
    await this.promotionsService.remove(id);
    return null;
  }
}
