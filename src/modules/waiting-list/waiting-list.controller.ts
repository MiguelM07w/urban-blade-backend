import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { JoinWaitingListDto } from './dto/join-waiting-list.dto';
import { WaitingListService } from './waiting-list.service';

@ApiTags('waiting-list')
@ApiBearerAuth()
@Controller('waiting-list')
export class WaitingListController {
  constructor(private readonly waitingListService: WaitingListService) {}

  @Post()
  @Roles(Role.CLIENT)
  @ResponseMessage('Te uniste a la lista de espera')
  @ApiOperation({ summary: 'Unirse a lista de espera' })
  join(
    @CurrentUser('userId') userId: string,
    @Body() dto: JoinWaitingListDto,
  ) {
    return this.waitingListService.join(userId, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Ver lista de espera (admin)' })
  findAll() {
    return this.waitingListService.findAll();
  }

  @Get('client/:clientId')
  @ApiOperation({ summary: 'Lista de espera del cliente' })
  findByClient(@Param('clientId') clientId: string) {
    return this.waitingListService.findByClient(clientId);
  }

  @Delete(':id')
  @Roles(Role.CLIENT)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Saliste de la lista de espera')
  @ApiOperation({ summary: 'Salir de lista de espera' })
  async leave(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.waitingListService.leave(id, userId);
    return null;
  }
}
