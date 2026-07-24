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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.CLIENT)
  @ResponseMessage('Reseña creada')
  @ApiOperation({ summary: 'Crear reseña (solo cliente, una por cita)' })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userId, dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar reseñas' })
  findAll() {
    return this.reviewsService.findAll();
  }

  @Get('barber/:barberId')
  @Public()
  @ApiOperation({ summary: 'Reseñas de un barbero' })
  findByBarber(@Param('barberId') barberId: string) {
    return this.reviewsService.findByBarber(barberId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.CLIENT)
  @ResponseMessage('Reseña actualizada')
  @ApiOperation({ summary: 'Editar reseña (solo autor)' })
  update(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.CLIENT, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Reseña eliminada')
  @ApiOperation({ summary: 'Eliminar reseña (admin o autor)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.reviewsService.remove(
      id,
      user.userId,
      user.role === Role.ADMIN,
    );
    return null;
  }
}
