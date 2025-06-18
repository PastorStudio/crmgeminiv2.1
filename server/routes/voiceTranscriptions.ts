/**
 * Rutas para transcripción de notas de voz
 */
import { Router } from 'express';
import { db } from '../db';
import { voiceNoteTranscriptions, mediaFiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { VoiceNoteTranscriptionService } from '../services/voiceNoteTranscriptionService';
import { whatsappMultiAccountManager } from '../services/whatsappMultiAccountManager';
import fs from 'fs';
import path from 'path';

const router = Router();
const transcriptionService = new VoiceNoteTranscriptionService();

// Obtener transcripción de nota de voz
router.get('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { chatId, accountId } = req.query;
    
    console.log(`🎤 Solicitando transcripción para mensaje: ${messageId}`);
    
    // Buscar transcripción existente
    let transcription = await db.select()
      .from(voiceNoteTranscriptions)
      .where(eq(voiceNoteTranscriptions.messageId, messageId))
      .limit(1);
    
    if (transcription.length > 0) {
      console.log(`✅ Transcripción encontrada: "${transcription[0].transcription}"`);
      return res.json({
        success: true,
        transcription: transcription[0].transcription,
        confidence: transcription[0].confidence,
        language: transcription[0].language
      });
    }
    
    // Si no existe transcripción, intentar procesar el archivo de voz
    if (chatId && accountId) {
      console.log(`🔄 Procesando nota de voz desde WhatsApp...`);
      
      try {
        const instance = whatsappMultiAccountManager.getInstance(parseInt(accountId as string));
        if (!instance || !instance.client) {
          return res.status(404).json({ 
            success: false, 
            error: 'Cuenta WhatsApp no disponible' 
          });
        }

        const chat = await instance.client.getChatById(chatId as string);
        const messages = await chat.fetchMessages({ limit: 100 });
        
        const voiceMessage = messages.find(msg => 
          msg.id._serialized === messageId && 
          msg.hasMedia && 
          (msg.type === 'ptt' || msg.type === 'audio')
        );
        
        if (!voiceMessage) {
          return res.status(404).json({ 
            success: false, 
            error: 'Nota de voz no encontrada' 
          });
        }

        // Descargar y transcribir
        const media = await voiceMessage.downloadMedia();
        if (!media) {
          return res.status(500).json({ 
            success: false, 
            error: 'Error descargando nota de voz' 
          });
        }

        const audioBuffer = Buffer.from(media.data, 'base64');
        const transcriptionText = await transcriptionService.transcribeAudio(audioBuffer, messageId);
        
        // Guardar transcripción en la base de datos
        const newTranscription = await db.insert(voiceNoteTranscriptions).values({
          messageId,
          chatId: chatId as string,
          accountId: parseInt(accountId as string),
          transcription: transcriptionText,
          confidence: 0.9,
          language: 'es',
          createdAt: new Date()
        }).returning();

        console.log(`✅ Nueva transcripción creada: "${transcriptionText}"`);
        
        return res.json({
          success: true,
          transcription: transcriptionText,
          confidence: 0.9,
          language: 'es'
        });
        
      } catch (error) {
        console.error('❌ Error procesando nota de voz:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Error procesando nota de voz' 
        });
      }
    }
    
    // No se encontró transcripción ni se puede procesar
    res.status(404).json({ 
      success: false, 
      error: 'Transcripción no disponible' 
    });
    
  } catch (error) {
    console.error('Error obteniendo transcripción:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Transcribir nota de voz específica
router.post('/:messageId/transcribe', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { chatId, accountId } = req.body;
    
    if (!chatId || !accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'chatId y accountId son requeridos' 
      });
    }
    
    console.log(`🎤 Forzando transcripción para mensaje: ${messageId}`);
    
    const instance = whatsappMultiAccountManager.getInstance(accountId);
    if (!instance || !instance.client) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cuenta WhatsApp no disponible' 
      });
    }

    const chat = await instance.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    
    const voiceMessage = messages.find(msg => 
      msg.id._serialized === messageId && 
      msg.hasMedia && 
      (msg.type === 'ptt' || msg.type === 'audio')
    );
    
    if (!voiceMessage) {
      return res.status(404).json({ 
        success: false, 
        error: 'Nota de voz no encontrada' 
      });
    }

    const media = await voiceMessage.downloadMedia();
    if (!media) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error descargando nota de voz' 
      });
    }

    const audioBuffer = Buffer.from(media.data, 'base64');
    const transcriptionText = await transcriptionService.transcribeAudio(audioBuffer, messageId);
    
    // Guardar o actualizar transcripción
    const existingTranscription = await db.select()
      .from(voiceNoteTranscriptions)
      .where(eq(voiceNoteTranscriptions.messageId, messageId))
      .limit(1);
    
    if (existingTranscription.length > 0) {
      await db.update(voiceNoteTranscriptions)
        .set({ 
          transcription: transcriptionText,
          confidence: 0.9,
          updatedAt: new Date()
        })
        .where(eq(voiceNoteTranscriptions.messageId, messageId));
    } else {
      await db.insert(voiceNoteTranscriptions).values({
        messageId,
        chatId,
        accountId,
        transcription: transcriptionText,
        confidence: 0.9,
        language: 'es',
        createdAt: new Date()
      });
    }

    console.log(`✅ Transcripción completada: "${transcriptionText}"`);
    
    res.json({
      success: true,
      transcription: transcriptionText,
      confidence: 0.9,
      language: 'es'
    });
    
  } catch (error) {
    console.error('Error transcribiendo nota de voz:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error transcribiendo nota de voz' 
    });
  }
});

export default router;