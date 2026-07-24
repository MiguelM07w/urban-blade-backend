import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelAppointmentDto {
  @ApiPropertyOptional({ description: 'Motivo de la cancelación' })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
