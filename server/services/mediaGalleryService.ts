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
    try {
      // Generar un nombre único para el archivo
      const fileExt = path.extname(file.originalname);
      const fileId = nanoid();
      const filename = `${Date.now()}_${fileId}${fileExt}`;
      const filePath = path.join(MEDIA_DIR, filename);
      
      // Asegurarse de que el directorio existe
      if (!fs.existsSync(MEDIA_DIR)) {
        fs.mkdirSync(MEDIA_DIR, { recursive: true });
      }
      
      // Guardar el archivo en el sistema de archivos
      await fs.promises.writeFile(filePath, file.buffer);
      
      // Preparar etiquetas para PostgreSQL
      let tagsValue = '{}'; // Array vacío por defecto en PostgreSQL
      if (options.tags && options.tags.length > 0) {
        const escapedTags = options.tags.map(tag => `"${tag}"`).join(',');
        tagsValue = `ARRAY[${escapedTags}]`;
      }
      
      // Registrar en la base de datos usando SQL
      const query = `
        INSERT INTO media_gallery 
        (filename, original_filename, mime_type, size, path, type, tags, title, description, uploaded_by, use_count, uploaded_at) 
        VALUES 
        (
          '${filename}',
          '${file.originalname.replace(/'/g, "''")}', 
          '${file.mimetype}', 
          ${file.size}, 
          '${filePath.replace(/'/g, "''")}', 
          '${options.type}', 
          ${tagsValue},
          ${options.title ? `'${options.title.replace(/'/g, "''")}'` : 'NULL'}, 
          ${options.description ? `'${options.description.replace(/'/g, "''")}'` : 'NULL'}, 
          ${options.uploadedBy || 'NULL'}, 
          0, 
          NOW()
        ) 
        RETURNING *;
      `;
      
      const result = await db.execute(query);
      const mediaItem = result.rows[0];
      
      return this.formatMediaItem(mediaItem);
    } catch (error) {
      console.error('Error en saveMedia:', error);
      throw new Error('Error al guardar archivo en la galería');
    }
  }
  
  /**
   * Obtiene un archivo por su ID
   */
  async getMediaById(id: number): Promise<MediaItem | null> {
    try {
      const query = `SELECT * FROM media_gallery WHERE id = ${id} LIMIT 1`;
      const result = await db.execute(query);
      
      if (!result.rows.length) {
        return null;
      }
      
      return this.formatMediaItem(result.rows[0]);
    } catch (error) {
      console.error('Error en getMediaById:', error);
      return null;
    }
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
    
    try {
      // Construir filtros SQL
      let conditions = [];
      
      // Filtrar por tipo
      if (type) {
        if (Array.isArray(type)) {
          conditions.push(`type IN (${type.map(t => `'${t}'`).join(',')})`);
        } else {
          conditions.push(`type = '${type}'`);
        }
      }
      
      // Filtrar por etiquetas (esto requiere SQL específico para Postgres arrays)
      if (tags) {
        if (Array.isArray(tags)) {
          // Al menos una de las etiquetas debe existir en el array
          const tagList = tags.map(t => `'${t}'`).join(',');
          conditions.push(`tags && ARRAY[${tagList}]`);
        } else {
          conditions.push(`'${tags}' = ANY(tags)`);
        }
      }
      
      // Búsqueda por texto
      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(`(
          (title IS NOT NULL AND title LIKE '${searchPattern}') OR
          (description IS NOT NULL AND description LIKE '${searchPattern}') OR
          original_filename LIKE '${searchPattern}'
        )`);
      }
      
      // Construir la cláusula WHERE
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Contar total de resultados primero
      const countQuery = `SELECT COUNT(*) as count FROM media_gallery ${whereClause}`;
      const countResult = await db.execute(countQuery);
      const total = Number(countResult.rows[0]?.count || 0);
      
      // Construir orden
      let orderClause = '';
      if (orderBy === 'uploadedAt') {
        orderClause = `ORDER BY uploaded_at ${order === 'desc' ? 'DESC' : 'ASC'}`;
      } else if (orderBy === 'useCount') {
        orderClause = `ORDER BY use_count ${order === 'desc' ? 'DESC' : 'ASC'}`;
      } else if (orderBy === 'lastUsedAt') {
        orderClause = `ORDER BY last_used_at ${order === 'desc' ? 'DESC' : 'ASC'}`;
      }
      
      // Paginación
      const offset = (page - 1) * limit;
      const paginationClause = `LIMIT ${limit} OFFSET ${offset}`;
      
      // Ejecutar consulta principal
      const query = `
        SELECT * FROM media_gallery 
        ${whereClause} 
        ${orderClause} 
        ${paginationClause}
      `;
      
      const result = await db.execute(query);
      const items = result.rows;
      
      // Formatear resultados
      return {
        items: items.map(item => this.formatMediaItem(item)),
        total
      };
    } catch (error) {
      console.error('Error en searchMedia:', error);
      return { items: [], total: 0 };
    }
  }
  
  /**
   * Actualiza los metadatos de un archivo
   */
  async updateMedia(id: number, data: {
    title?: string;
    description?: string;
    tags?: string[];
  }): Promise<MediaItem | null> {
    try {
      // Construir la consulta de actualización
      const updateFields = [];
      const params: any = {};
      
      if (data.title !== undefined) {
        updateFields.push(`title = '${data.title}'`);
      }
      
      if (data.description !== undefined) {
        updateFields.push(`description = '${data.description}'`);
      }
      
      if (data.tags !== undefined && Array.isArray(data.tags)) {
        // Convertir array a string para PostgreSQL
        const tagsStr = data.tags.map(tag => `"${tag}"`).join(',');
        updateFields.push(`tags = ARRAY[${tagsStr}]`);
      }
      
      if (updateFields.length === 0) {
        // No hay nada que actualizar
        return await this.getMediaById(id);
      }
      
      // Ejecutar la actualización
      const updateQuery = `
        UPDATE media_gallery 
        SET ${updateFields.join(', ')} 
        WHERE id = ${id}
      `;
      
      await db.execute(updateQuery);
      
      // Retornar el elemento actualizado
      return await this.getMediaById(id);
    } catch (error) {
      console.error('Error en updateMedia:', error);
      return null;
    }
  }
  
  /**
   * Elimina un archivo de la galería
   */
  async deleteMedia(id: number): Promise<boolean> {
    try {
      // Primero, obtener el archivo para saber qué eliminar físicamente
      const query = `SELECT * FROM media_gallery WHERE id = ${id} LIMIT 1`;
      const result = await db.execute(query);
      
      if (!result.rows.length) {
        return false;
      }
      
      const mediaItem = result.rows[0];
      
      // Eliminar el archivo físico
      try {
        await fs.promises.unlink(mediaItem.path.toString());
      } catch (error) {
        console.error('Error al eliminar archivo físico:', error);
      }
      
      // Eliminar de la base de datos
      const deleteQuery = `DELETE FROM media_gallery WHERE id = ${id}`;
      await db.execute(deleteQuery);
      
      return true;
    } catch (error) {
      console.error('Error en deleteMedia:', error);
      return false;
    }
  }
  
  /**
   * Registra el uso de un archivo para estadísticas
   */
  async trackMediaUsage(id: number): Promise<void> {
    try {
      // Usamos SQL directo para actualizar el contador
      const query = `
        UPDATE media_gallery 
        SET use_count = use_count + 1, 
            last_used_at = NOW() 
        WHERE id = ${id}
      `;
      await db.execute(query);
    } catch (error) {
      console.error('Error en trackMediaUsage:', error);
    }
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