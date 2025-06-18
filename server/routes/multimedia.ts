/**
 * Rutas para servir archivos multimedia de WhatsApp
 */
import { Router } from 'express';
import { db } from '../db';
import { mediaFiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const router = Router();

// Servir archivo multimedia por ID
router.get('/file/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    
    // Buscar archivo en la base de datos
    const mediaFile = await db.select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, parseInt(mediaId)))
      .limit(1);
    
    if (mediaFile.length === 0) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    const file = mediaFile[0];
    
    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ error: 'Archivo físico no encontrado' });
    }
    
    // Configurar headers apropiados
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    
    // Enviar archivo
    res.sendFile(path.resolve(file.filePath));
    
  } catch (error) {
    console.error('Error sirviendo archivo multimedia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener información de archivo multimedia
router.get('/info/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const mediaFile = await db.select()
      .from(mediaFiles)
      .where(eq(mediaFiles.messageId, messageId))
      .limit(1);
    
    if (mediaFile.length === 0) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    const file = mediaFile[0];
    
    res.json({
      id: file.id,
      messageId: file.messageId,
      fileName: file.fileName,
      fileType: file.fileType,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      fileUrl: `/api/multimedia/file/${file.id}`,
      thumbnailPath: file.thumbnailPath,
      duration: file.duration,
      dimensions: file.dimensions,
      metadata: file.metadata,
      createdAt: file.createdAt
    });
    
  } catch (error) {
    console.error('Error obteniendo información de archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar archivos multimedia por chat
router.get('/chat/:accountId/:chatId', async (req, res) => {
  try {
    const { accountId, chatId } = req.params;
    
    const mediaFile = await db.select()
      .from(mediaFiles)
      .where(and(
        eq(mediaFiles.accountId, parseInt(accountId))
      ))
      .orderBy(mediaFiles.createdAt);
    
    const filesInfo = mediaFile.map(file => ({
      id: file.id,
      messageId: file.messageId,
      fileName: file.fileName,
      fileType: file.fileType,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      fileUrl: `/api/multimedia/file/${file.id}`,
      thumbnailPath: file.thumbnailPath,
      duration: file.duration,
      dimensions: file.dimensions,
      createdAt: file.createdAt
    }));
    
    res.json(filesInfo);
    
  } catch (error) {
    console.error('Error listando archivos de chat:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;