import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { RedeemDto } from './dto/redeem.dto';
import { ValidateReferralDto } from './dto/validate-referral.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('coupons')
  @Public()
  @ApiOperation({ summary: 'Listar cupones disponibles' })
  listCoupons() {
    return this.loyaltyService.listAvailableCoupons();
  }

  @Post('coupons')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Audit(AuditAction.COUPON_CREATED)
  @ResponseMessage('Cupón creado')
  @ApiOperation({ summary: 'Crear cupón (admin)' })
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.loyaltyService.createCoupon(dto);
  }

  @Post('redeem')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cupón canjeado')
  @ApiOperation({
    summary: 'Canjear un CUPÓN (código de admin), no un referido',
  })
  redeem(@CurrentUser('userId') userId: string, @Body() dto: RedeemDto) {
    return this.loyaltyService.redeemCoupon(userId, dto.code);
  }

  @Post('redeem-free-service')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Servicio gratis canjeado')
  @ApiOperation({
    summary: 'Canjear un servicio gratis acumulado (cada 10 visitas)',
  })
  redeemFreeService(@CurrentUser('userId') userId: string) {
    return this.loyaltyService.redeemFreeService(userId);
  }

  @Post('referral/validate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar código de referido (sin aplicarlo)' })
  validateReferral(@Body() dto: ValidateReferralDto) {
    return this.loyaltyService.validateReferral(dto.referralCode);
  }

  @Post('referral/apply')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Código de referido aplicado')
  @ApiOperation({
    summary: 'Aplicar el código de referido de otro usuario (uso único)',
  })
  applyReferral(
    @CurrentUser('userId') userId: string,
    @Body() dto: ApplyReferralDto,
  ) {
    return this.loyaltyService.applyReferral(userId, dto.referralCode);
  }

  @Get(':userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ver puntos y nivel del usuario' })
  findByUser(@Param('userId') userId: string) {
    return this.loyaltyService.findByUser(userId);
  }

  @Get(':userId/history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historial de puntos' })
  getHistory(@Param('userId') userId: string) {
    return this.loyaltyService.getHistory(userId);
  }
}
