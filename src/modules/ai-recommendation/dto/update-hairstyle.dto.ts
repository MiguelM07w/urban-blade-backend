import { PartialType } from '@nestjs/swagger';
import { CreateHairstyleDto } from './create-hairstyle.dto';

export class UpdateHairstyleDto extends PartialType(CreateHairstyleDto) {}
