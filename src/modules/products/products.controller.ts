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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Producto creado')
  @ApiOperation({ summary: 'Crear producto (admin)' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar productos' })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener producto por ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Producto actualizado')
  @ApiOperation({ summary: 'Actualizar producto (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Producto eliminado')
  @ApiOperation({ summary: 'Eliminar producto (admin)' })
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return null;
  }
}
