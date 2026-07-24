import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AIRecommendationService } from './ai-recommendation.service';
import { AnalyzeDto } from './dto/analyze.dto';
import { CreateHairstyleDto } from './dto/create-hairstyle.dto';
import { ShareWithBarberDto } from './dto/share-with-barber.dto';
import { UpdateHairstyleDto } from './dto/update-hairstyle.dto';

@ApiTags('ai-recommendation')
@Controller('ai')
export class AIRecommendationController {
  constructor(private readonly aiService: AIRecommendationService) {}

  @Post('analyze')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Recomendaciones generadas')
  @ApiOperation({
    summary: 'Recibir análisis del móvil y devolver recomendaciones',
  })
  analyze(
    @CurrentUser('userId') userId: string,
    @Body() dto: AnalyzeDto,
  ) {
    return this.aiService.analyze(userId, dto);
  }

  @Get('recommendations/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historial de recomendaciones' })
  getHistory(@Param('userId') userId: string) {
    return this.aiService.getHistory(userId);
  }

  @Post('share-with-barber')
  @ApiBearerAuth()
  @Roles(Role.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Estilo compartido con el barbero')
  @ApiOperation({ summary: 'Compartir estilo elegido con barbero' })
  shareWithBarber(
    @CurrentUser('userId') userId: string,
    @Body() dto: ShareWithBarberDto,
  ) {
    return this.aiService.shareWithBarber(userId, dto.barber, dto.hairstyle);
  }

  @Get('hairstyles')
  @Public()
  @ApiOperation({ summary: 'Catálogo completo de estilos' })
  findAllHairstyles() {
    return this.aiService.findAllHairstyles();
  }

  @Post('hairstyles')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Estilo agregado al catálogo')
  @ApiOperation({ summary: 'Agregar estilo al catálogo (admin)' })
  createHairstyle(@Body() dto: CreateHairstyleDto) {
    return this.aiService.createHairstyle(dto);
  }

  @Patch('hairstyles/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Estilo actualizado')
  @ApiOperation({ summary: 'Editar estilo (admin)' })
  updateHairstyle(
    @Param('id') id: string,
    @Body() dto: UpdateHairstyleDto,
  ) {
    return this.aiService.updateHairstyle(id, dto);
  }
}
