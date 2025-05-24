import { db } from '../db';
import { voiceNoteTranscriptions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

export class VoiceNoteTranscriptionService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  /**
   * Transcribir un archivo de audio usando OpenAI Whisper
   */
  async transcribeAudio(audioBuffer: Buffer, messageId: string): Promise<string> {
    try {
      console.log(`🎤 Iniciando transcripción para mensaje ${messageId}...`);
      
      // Crear un archivo temporal para OpenAI
      const fs = await import('fs');
      const path = await import('path');
      const tempDir = path.join(process.cwd(), 'temp');
      
      // Crear directorio temporal si no existe
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `voice_${messageId}.ogg`);
      fs.writeFileSync(tempFile, audioBuffer);
      
      // Transcribir usando OpenAI Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: "whisper-1",
        language: "es", // Español por defecto
      });
      
      // Limpiar archivo temporal
      fs.unlinkSync(tempFile);
      
      console.log(`✅ Transcripción completada: "${transcription.text}"`);
      return transcription.text;
      
    } catch (error) {
      console.error('❌ Error en transcripción:', error);
      return '[Error al transcribir audio]';
    }
  }

  /**
   * Guardar transcripción en la base de datos
   */
  async saveTranscription(
    messageId: string,
    chatId: string,
    accountId: number,
    transcription: string,
    duration?: number
  ): Promise<void> {
    try {
      await db.insert(voiceNoteTranscriptions).values({
        messageId,
        chatId,
        accountId,
        transcription,
        duration,
      }).onConflictDoUpdate({
        target: voiceNoteTranscriptions.messageId,
        set: {
          transcription,
          duration,
          processedAt: new Date(),
        }
      });
      
      console.log(`💾 Transcripción guardada en BD para mensaje ${messageId}`);
    } catch (error) {
      console.error('❌ Error guardando transcripción:', error);
    }
  }

  /**
   * Obtener transcripción desde la base de datos
   */
  async getTranscription(messageId: string): Promise<string | null> {
    try {
      const [result] = await db
        .select()
        .from(voiceNoteTranscriptions)
        .where(eq(voiceNoteTranscriptions.messageId, messageId))
        .limit(1);
      
      return result?.transcription || null;
    } catch (error) {
      console.error('❌ Error obteniendo transcripción:', error);
      return null;
    }
  }

  /**
   * Procesar nota de voz completa: transcribir y guardar
   */
  async processVoiceNote(
    messageId: string,
    chatId: string,
    accountId: number,
    audioBuffer: Buffer,
    duration?: number
  ): Promise<string> {
    try {
      // Verificar si ya existe la transcripción
      const existingTranscription = await this.getTranscription(messageId);
      if (existingTranscription) {
        console.log(`♻️ Transcripción ya existe para mensaje ${messageId}`);
        return existingTranscription;
      }

      // Transcribir el audio
      const transcription = await this.transcribeAudio(audioBuffer, messageId);
      
      // Guardar en base de datos
      await this.saveTranscription(messageId, chatId, accountId, transcription, duration);
      
      return transcription;
    } catch (error) {
      console.error('❌ Error procesando nota de voz:', error);
      return '[Error procesando audio]';
    }
  }

  /**
   * Obtener todas las transcripciones de un chat
   */
  async getChatTranscriptions(chatId: string, accountId: number) {
    try {
      return await db
        .select()
        .from(voiceNoteTranscriptions)
        .where(
          and(
            eq(voiceNoteTranscriptions.chatId, chatId),
            eq(voiceNoteTranscriptions.accountId, accountId)
          )
        )
        .orderBy(voiceNoteTranscriptions.createdAt);
    } catch (error) {
      console.error('❌ Error obteniendo transcripciones del chat:', error);
      return [];
    }
  }
}

export const voiceNoteTranscriptionService = new VoiceNoteTranscriptionService();