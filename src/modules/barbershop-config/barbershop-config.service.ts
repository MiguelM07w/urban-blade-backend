import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateConfigDto } from './dto/update-config.dto';
import { HolidayDto } from './dto/update-holidays.dto';
import {
  BarbershopConfig,
  BarbershopConfigDocument,
} from './schemas/barbershop-config.schema';

@Injectable()
export class BarbershopConfigService {
  constructor(
    @InjectModel(BarbershopConfig.name)
    private readonly configModel: Model<BarbershopConfigDocument>,
  ) {}

  /**
   * Devuelve la configuración (singleton). Si aún no existe, la crea con los
   * valores por defecto del schema.
   */
  async getOrCreate(): Promise<BarbershopConfigDocument> {
    const existing = await this.configModel.findOne().exec();
    if (existing) {
      return existing;
    }
    return this.configModel.create({});
  }

  /**
   * Actualiza la configuración. Trabaja siempre sobre el documento singleton.
   */
  async update(dto: UpdateConfigDto): Promise<BarbershopConfigDocument> {
    const config = await this.getOrCreate();
    config.set(dto);
    await config.save();
    return config;
  }

  /**
   * Datos de ubicación: coordenadas y enlaces de mapa.
   */
  async getMap(): Promise<{
    coordinates: { lat: number; lng: number };
    googleMapsUrl: string;
    wazeUrl: string;
    address: string;
  }> {
    const config = await this.getOrCreate();
    return {
      coordinates: {
        lat: config.coordinates.lat,
        lng: config.coordinates.lng,
      },
      googleMapsUrl: config.googleMapsUrl,
      wazeUrl: config.wazeUrl,
      address: config.address,
    };
  }

  /**
   * Reemplaza la lista de feriados.
   */
  async updateHolidays(
    holidays: HolidayDto[],
  ): Promise<BarbershopConfigDocument> {
    const config = await this.getOrCreate();
    config.holidays = holidays.map((h) => ({
      date: h.date,
      description: h.description ?? '',
    }));
    await config.save();
    return config;
  }

  // ---- Helpers de configuración reutilizables por otros módulos ----

  /**
   * Ventana de cancelación en horas (fuente única de verdad para appointments).
   */
  async getCancellationWindowHours(): Promise<number> {
    const config = await this.getOrCreate();
    return config.cancellationWindowHours;
  }

  /**
   * Duración del slot en minutos.
   */
  async getSlotDuration(): Promise<number> {
    const config = await this.getOrCreate();
    return config.slotDuration;
  }
}
