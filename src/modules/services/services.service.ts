import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service, ServiceDocument } from './schemas/service.schema';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
  ) {}

  async create(dto: CreateServiceDto): Promise<ServiceDocument> {
    return this.serviceModel.create(dto);
  }

  async findAll(): Promise<ServiceDocument[]> {
    return this.serviceModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<ServiceDocument> {
    this.assertValidId(id);
    const service = await this.serviceModel
      .findOne({ _id: id, isActive: true })
      .exec();
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return service;
  }

  async findFeatured(): Promise<ServiceDocument | null> {
    return this.serviceModel
      .findOne({ isActive: true, isMonthlyFeatured: true })
      .exec();
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceDocument> {
    this.assertValidId(id);
    const updated = await this.serviceModel
      .findOneAndUpdate({ _id: id, isActive: true }, dto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return updated;
  }

  /**
   * Marca este servicio como "corte del mes", desmarcando cualquier otro.
   */
  async setFeatured(id: string): Promise<ServiceDocument> {
    this.assertValidId(id);
    await this.serviceModel
      .updateMany({ isMonthlyFeatured: true }, { isMonthlyFeatured: false })
      .exec();
    const updated = await this.serviceModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { isMonthlyFeatured: true },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.assertValidId(id);
    const result = await this.serviceModel
      .findOneAndUpdate(
        { _id: id, isActive: true },
        { isActive: false },
        { new: true },
      )
      .exec();
    if (!result) {
      throw new NotFoundException('Servicio no encontrado');
    }
  }

  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('El id proporcionado no es válido');
    }
  }
}
