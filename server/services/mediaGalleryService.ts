/**
 * Servicio para gestionar la galería de archivos multimedia
 * Permite almacenar, categorizar y reutilizar archivos subidos al sistema
 */

import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { mediaGallery } from '@shared/schema';
import { eq, desc, asc, and, like, or, inArray } from 'drizzle-orm';

// Ruta para almacenar archivos multimedia
const MEDIA_DIR = path.join(process.cwd(), 'temp', 'media');

// Asegurarse de que el directorio existe
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Interfaz de un elemento de la galería
export interface MediaItem {
  id: number;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  path: string;
  type: string;
  tags?: string[];
  title?: string;
  description?: string;
  uploadedBy?: number;
  uploadedAt: Date;
  lastUsedAt?: Date;
  useCount: number;
  url?: string; // URL para acceso público (no se almacena en BD)
}

// Opciones para filtros de búsqueda
export interface MediaSearchOptions {
  type?: string | string[];
  tags?: string | string[];
  search?: string;
  orderBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

class MediaGalleryService {
  /**
   * Guarda un archivo en la galería
   */
  async saveMedia(file: Express.Multer.File, options: {
    type: string;
    title?: string;
    description?: string;
    tags?: string[];
    uploadedBy?: number;
  }): Promise<MediaItem> {
    // Generar un nombre único para el archivo
    const fileExt = path.extname(file.originalname);
    const fileId = nanoid();
    const filename = `${Date.now()}_${fileId}${fileExt}`;
    const filePath = path.join(MEDIA_DIR, filename);
    
    // Guardar el archivo en el sistema de archivos
    await fs.promises.writeFile(filePath, file.buffer);
    
    // Registrar en la base de datos
    const [mediaItem] = await db.insert(mediaGallery).values({
      filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: filePath,
      type: options.type,
      tags: options.tags || [],
      title: options.title,
      description: options.description,
      uploadedBy: options.uploadedBy,
      useCount: 0
    }).returning();
    
    return this.formatMediaItem(mediaItem);
  }
  
  /**
   * Obtiene un archivo por su ID
   */
  async getMediaById(id: number): Promise<MediaItem | null> {
    const [mediaItem] = await db.select().from(mediaGallery).where(eq(mediaGallery.id, id));
    
    if (!mediaItem) {
      return null;
    }
    
    return this.formatMediaItem(mediaItem);
  }
  
  /**
   * Busca archivos según criterios
   */
  async searchMedia(options: MediaSearchOptions = {}): Promise<{ items: MediaItem[], total: number }> {
    // Parámetros por defecto
    const {
      type,
      tags,
      search,
      orderBy = 'uploadedAt',
      order = 'desc',
      page = 1,
      limit = 20
    } = options;
    
    // Construir consulta con condiciones
    let query = db.select().from(mediaGallery);
    let conditions = [];
    
    // Filtrar por tipo
    if (type) {
      if (Array.isArray(type)) {
        conditions.push(inArray(mediaGallery.type, type));
      } else {
        conditions.push(eq(mediaGallery.type, type));
      }
    }
    
    // Filtrar por etiquetas
    if (tags) {
      if (Array.isArray(tags)) {
        // Se debe tener al menos una de las etiquetas especificadas
        conditions.push(inArray(mediaGallery.tags, tags));
      } else {
        conditions.push(inArray(mediaGallery.tags, [tags]));
      }
    }
    
    // Búsqueda por texto
    if (search) {
      conditions.push(
        or(
          like(mediaGallery.title || '', `%${search}%`),
          like(mediaGallery.description || '', `%${search}%`),
          like(mediaGallery.originalFilename, `%${search}%`)
        )
      );
    }
    
    // Aplicar condiciones
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Contar total de resultados
    const [countResult] = await db.select({ count: db.fn.count() }).from(mediaGallery);
    const total = Number(countResult.count) || 0;
    
    // Ordenar resultados
    if (orderBy === 'uploadedAt') {
      query = order === 'desc' 
        ? query.orderBy(desc(mediaGallery.uploadedAt))
        : query.orderBy(asc(mediaGallery.uploadedAt));
    } else if (orderBy === 'useCount') {
      query = order === 'desc'
        ? query.orderBy(desc(mediaGallery.useCount))
        : query.orderBy(asc(mediaGallery.useCount));
    } else if (orderBy === 'lastUsedAt') {
      query = order === 'desc'
        ? query.orderBy(desc(mediaGallery.lastUsedAt))
        : query.orderBy(asc(mediaGallery.lastUsedAt));
    }
    
    // Paginación
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);
    
    // Ejecutar consulta
    const items = await query;
    
    // Formatear resultados
    return {
      items: items.map(item => this.formatMediaItem(item)),
      total
    };
  }
  
  /**
   * Actualiza los metadatos de un archivo
   */
  async updateMedia(id: number, data: {
    title?: string;
    description?: string;
    tags?: string[];
  }): Promise<MediaItem | null> {
    const [updated] = await db.update(mediaGallery)
      .set(data)
      .where(eq(mediaGallery.id, id))
      .returning();
      
    if (!updated) {
      return null;
    }
    
    return this.formatMediaItem(updated);
  }
  
  /**
   * Elimina un archivo de la galería
   */
  async deleteMedia(id: number): Promise<boolean> {
    const [mediaItem] = await db.select().from(mediaGallery).where(eq(mediaGallery.id, id));
    
    if (!mediaItem) {
      return false;
    }
    
    // Eliminar el archivo físico
    try {
      await fs.promises.unlink(mediaItem.path);
    } catch (error) {
      console.error('Error al eliminar archivo físico:', error);
    }
    
    // Eliminar de la base de datos
    await db.delete(mediaGallery).where(eq(mediaGallery.id, id));
    
    return true;
  }
  
  /**
   * Registra el uso de un archivo para estadísticas
   */
  async trackMediaUsage(id: number): Promise<void> {
    await db.update(mediaGallery)
      .set({
        useCount: db.sql`${mediaGallery.useCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(eq(mediaGallery.id, id));
  }
  
  /**
   * Formatea un elemento de la galería
   */
  private formatMediaItem(item: any): MediaItem {
    // Crear URL para acceso público
    const baseUrl = '/api/media';
    const url = `${baseUrl}/${item.id}/${encodeURIComponent(item.originalFilename)}`;
    
    return {
      ...item,
      url
    };
  }
}

export const mediaGalleryService = new MediaGalleryService();