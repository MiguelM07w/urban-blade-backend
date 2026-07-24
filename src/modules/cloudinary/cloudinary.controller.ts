import {
  Controller,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CloudinaryService } from './cloudinary.service';

/** 5 MB máximo por imagen. */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      // En memoria: el buffer se canaliza directo a Cloudinary.
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ResponseMessage('Imagen subida')
  @ApiOperation({ summary: 'Subir una imagen a Cloudinary' })
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Query('folder') folder?: string,
  ): Promise<{ url: string; publicId: string }> {
    const result = await this.cloudinaryService.uploadImage(file, folder);
    return { url: result.secure_url, publicId: result.public_id };
  }
}
