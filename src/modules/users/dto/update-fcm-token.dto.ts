import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateFcmTokenDto {
  @ApiProperty({ description: 'Token de Firebase Cloud Messaging del dispositivo' })
  @IsString()
  fcmToken!: string;
}
