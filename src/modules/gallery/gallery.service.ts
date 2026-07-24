import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Hairstyle,
  HairstyleDocument,
} from '../ai-recommendation/schemas/hairstyle.schema';
import { Barber, BarberDocument } from '../barbers/schemas/barber.schema';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import { GalleryItemType } from './enums/gallery-item-type.enum';

/**
 * Un item del feed de galería, normalizado desde su origen (corte o trabajo de
 * barbero) para que el frontend lo pinte de forma uniforme.
 */
export interface GalleryItem {
  type: GalleryItemType;
  imageUrl: string;
  // Metadata común (según origen; los no aplicables van null/vacíos).
  title: string;
  category: string | null;
  faceTypes: string[];
  hairTypes: string[];
  isTrending: boolean;
  // Datos del barbero cuando type = barber_work.
  barberId: string | null;
  barberName: string | null;
}

@Injectable()
export class GalleryService {
  constructor(
    @InjectModel(Hairstyle.name)
    private readonly hairstyleModel: Model<HairstyleDocument>,
    @InjectModel(Barber.name)
    private readonly barberModel: Model<BarberDocument>,
  ) {}

  /**
   * Feed público de galería que combina imágenes de cortes (Hairstyle) y fotos
   * reales de portafolios de barberos, con filtros. Devuelve un item por imagen,
   * paginado en memoria (los filtros se aplican en la consulta a cada origen).
   */
  async find(query: GalleryQueryDto): Promise<{
    items: GalleryItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const items: GalleryItem[] = [];

    // ¿Se piden hairstyles? (si no hay filtro de tipo, o el tipo es hairstyle)
    const wantHairstyles =
      !query.type || query.type === GalleryItemType.HAIRSTYLE;
    // Los trabajos de barbero no tienen faceType/hairType/category/trending, así
    // que si se filtra por alguno de esos, no aplican.
    const styleOnlyFilter =
      query.faceType !== undefined ||
      query.hairType !== undefined ||
      query.category !== undefined ||
      query.trending !== undefined;
    const wantBarberWork =
      (!query.type || query.type === GalleryItemType.BARBER_WORK) &&
      !styleOnlyFilter;

    if (wantHairstyles) {
      items.push(...(await this.hairstyleItems(query)));
    }
    if (wantBarberWork) {
      items.push(...(await this.barberWorkItems(query)));
    }

    // Trending primero, para que la galería luzca mejor.
    items.sort((a, b) => Number(b.isTrending) - Number(a.isTrending));

    const total = items.length;
    const start = (query.page - 1) * query.limit;
    const paged = items.slice(start, start + query.limit);
    return { items: paged, total, page: query.page, limit: query.limit };
  }

  private async hairstyleItems(query: GalleryQueryDto): Promise<GalleryItem[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (query.faceType) {
      filter.faceTypes = query.faceType;
    }
    if (query.hairType) {
      filter.hairTypes = query.hairType;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.trending !== undefined) {
      filter.isTrending = query.trending;
    }

    const styles = await this.hairstyleModel
      .find(filter)
      .sort({ isTrending: -1, name: 1 })
      .exec();

    const items: GalleryItem[] = [];
    for (const style of styles) {
      for (const imageUrl of style.images) {
        items.push({
          type: GalleryItemType.HAIRSTYLE,
          imageUrl,
          title: style.name,
          category: style.category,
          faceTypes: style.faceTypes,
          hairTypes: style.hairTypes,
          isTrending: style.isTrending,
          barberId: null,
          barberName: null,
        });
      }
    }
    return items;
  }

  private async barberWorkItems(
    query: GalleryQueryDto,
  ): Promise<GalleryItem[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (query.barber && Types.ObjectId.isValid(query.barber)) {
      filter._id = new Types.ObjectId(query.barber);
    }

    const barbers = await this.barberModel
      .find(filter)
      .populate('user', 'name')
      .exec();

    const items: GalleryItem[] = [];
    for (const barber of barbers) {
      const user = barber.user as unknown as { name?: string } | null;
      const barberName = user?.name ?? null;
      for (const imageUrl of barber.portfolio) {
        items.push({
          type: GalleryItemType.BARBER_WORK,
          imageUrl,
          title: barberName ? `Trabajo de ${barberName}` : 'Trabajo de barbero',
          category: null,
          faceTypes: [],
          hairTypes: [],
          isTrending: false,
          barberId: barber.id,
          barberName,
        });
      }
    }
    return items;
  }
}
