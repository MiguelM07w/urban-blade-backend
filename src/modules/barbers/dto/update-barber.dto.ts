import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateBarberDto } from './create-barber.dto';

export class UpdateBarberDto extends PartialType(
  OmitType(CreateBarberDto, ['user'] as const),
) {}
