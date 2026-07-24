import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    return this.productModel.create(dto);
  }

  async findAll(): Promise<ProductDocument[]> {
    return this.productModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<ProductDocument> {
    this.assertValidId(id);
    const product = await this.productModel
      .findOne({ _id: id, isActive: true })
      .exec();
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  /**
   * Descuenta stock de forma ATÓMICA: solo baja si hay suficiente (evita
   * sobreventa cuando dos compras concurren). Devuelve true si se descontó,
   * false si no había stock suficiente. Usado por orders al pagar/vender.
   */
  async decrementStock(id: string, quantity: number): Promise<boolean> {
    this.assertValidId(id);
    const result = await this.productModel
      .updateOne(
        { _id: id, isActive: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  /**
   * Devuelve stock a un producto (p. ej. al cancelar/reembolsar una compra).
   */
  async incrementStock(id: string, quantity: number): Promise<void> {
    this.assertValidId(id);
    await this.productModel
      .updateOne({ _id: id }, { $inc: { stock: quantity } })
      .exec();
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    this.assertValidId(id);
    const updated = await this.productModel
      .findOneAndUpdate({ _id: id, isActive: true }, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Producto no encontrado');
    }
    return updated;
  }

  /**
   * Soft delete: marca isActive = false.
   */
  async remove(id: string): Promise<void> {
    this.assertValidId(id);
    const result = await this.productModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { isActive: false },
        { new: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException('Producto no encontrado');
    }
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('El id proporcionado no es válido');
    }
  }
}
