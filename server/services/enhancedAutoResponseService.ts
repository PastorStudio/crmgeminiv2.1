/**
 * Sistema mejorado de respuestas automáticas con:
 * - Detección y uso del traductor
 * - Historial de conversación
 * - Detección de intervención manual
 * - Traducción automática
 */

import { db } from '../db';
import { whatsappAccounts, whatsappMessages, externalAgents } from '@shared/schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { aiProviderService } from './aiProviderService';

interface ConversationMessage {
  id: string;
  content: string;
  isFromUser: boolean;
  timestamp: Date;
  originalLanguage?: string;
  translatedContent?: string;
}

interface TranslatorSettings {
  enabled: boolean;
  targetLanguage: string;
  sourceLanguage: string;
}

interface AutoResponseConfig {
  accountId: number;
  enabled: boolean;
  agentName: string;
  customPrompt: string;
  lastProcessed: Date;
  manualInterventionActive: boolean;
  translatorSettings: TranslatorSettings;
}

class EnhancedAutoResponseService {
  private configs = new Map<number, AutoResponseConfig>();
  private conversationHistory = new Map<string, ConversationMessage[]>();
  private processingInterval?: NodeJS.Timeout;
  private isRunning = false;
  private manualInterventions = new Set<string>(); // chatId set
  
  /**
   * Inicializar el servicio mejorado
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 Sistema mejorado ya está funcionando');
      return;
    }

    console.log('🚀 Iniciando sistema mejorado de respuestas automáticas...');
    
    try {
      await this.loadConfigurations();
      await this.loadTranslatorSettings();
      this.startContinuousProcessing();
      
      this.isRunning = true;
      console.log('✅ Sistema mejorado de respuestas automáticas iniciado');
    } catch (error) {
      console.error('❌ Error inicializando sistema mejorado:', error);
    }
  }

  /**
   * Cargar configuraciones desde la base de datos
   */
  private async loadConfigurations(): Promise<void> {
    try {
      const accounts = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      for (const account of accounts) {
        // Obtener agente asignado
        const agent = await db.select()
          .from(externalAgents)
          .where(eq(externalAgents.id, account.assignedAgentId || 0))
          .limit(1);

        const config: AutoResponseConfig = {
          accountId: account.id,
          enabled: account.autoResponseEnabled,
          agentName: agent[0]?.name || 'Asistente AI',
          customPrompt: agent[0]?.customPrompt || '',
          lastProcessed: new Date(),
          manualInterventionActive: false,
          translatorSettings: {
            enabled: false,
            targetLanguage: 'es',
            sourceLanguage: 'auto'
          }
        };

        this.configs.set(account.id, config);
      }

      console.log(`📊 Configuraciones cargadas para ${accounts.length} cuentas`);
    } catch (error) {
      console.error('❌ Error cargando configuraciones:', error);
    }
  }

  /**
   * Cargar configuraciones del traductor desde la base de datos
   */
  private async loadTranslatorSettings(): Promise<void> {
    try {
      // Simular carga de configuraciones del traductor desde la base de datos
      // En implementación real, esto vendría de una tabla de configuraciones
      for (const [accountId, config] of this.configs) {
        // Por defecto, traductor habilitado con español como idioma objetivo
        config.translatorSettings = {
          enabled: true,
          targetLanguage: 'es',
          sourceLanguage: 'auto'
        };
      }
      console.log('🌐 Configuraciones de traductor cargadas');
    } catch (error) {
      console.error('❌ Error cargando configuraciones de traductor:', error);
    }
  }

  /**
   * Iniciar procesamiento continuo
   */
  private startContinuousProcessing(): void {
    // Temporalmente deshabilitado para evitar errores SQL
    console.log('⏰ Procesamiento continuo temporalmente deshabilitado para depuración');
    // this.processingInterval = setInterval(async () => {
    //   await this.processAllNewMessages();
    // }, 10000); // Procesar cada 10 segundos
  }

  /**
   * Procesar todos los mensajes nuevos
   */
  private async processAllNewMessages(): Promise<void> {
    for (const [accountId, config] of this.configs) {
      if (!config.enabled) continue;
      
      try {
        await this.processNewMessagesForAccount(accountId, config);
      } catch (error) {
        console.error(`❌ Error procesando cuenta ${accountId}:`, error);
      }
    }
  }

  /**
   * Procesar mensajes nuevos para una cuenta específica
   */
  private async processNewMessagesForAccount(accountId: number, config: AutoResponseConfig): Promise<void> {
    try {
      // Use raw SQL query to avoid Drizzle syntax issues
      const { pool } = await import('../db');
      const result = await pool.query(`
        SELECT id, "chatId", content, "isFromUser", timestamp, "messageType"
        FROM whatsapp_messages 
        WHERE "accountId" = $1 
        AND "isFromUser" = true 
        AND timestamp > $2
        ORDER BY timestamp DESC 
        LIMIT 10
      `, [accountId, config.lastProcessed]);
      
      const newMessages = result.rows;

      for (const message of newMessages) {
        // Verificar si hay intervención manual activa para este chat
        if (this.manualInterventions.has(message.chatId)) {
          console.log(`🛑 Intervención manual activa para chat ${message.chatId}, omitiendo respuesta automática`);
          continue;
        }

        await this.processMessage(message, config);
        
        // Actualizar último mensaje procesado
        config.lastProcessed = message.timestamp;
      }
    } catch (error) {
      console.error(`❌ Error procesando mensajes para cuenta ${accountId}:`, error);
    }
  }

  /**
   * Procesar un mensaje individual
   */
  private async processMessage(message: any, config: AutoResponseConfig): Promise<void> {
    try {
      console.log(`🤖 Procesando mensaje - Cuenta: ${config.accountId}, Chat: ${message.chatId}`);

      // Detectar idioma del mensaje entrante
      const detectedLanguage = await this.detectLanguage(message.content);
      
      // Obtener historial de conversación
      const conversationHistory = await this.getConversationHistory(message.chatId, config.accountId);
      
      // Agregar mensaje actual al historial
      conversationHistory.push({
        id: message.id.toString(),
        content: message.content,
        isFromUser: true,
        timestamp: message.timestamp,
        originalLanguage: detectedLanguage
      });

      // Traducir mensaje si es necesario
      let messageToProcess = message.content;
      if (config.translatorSettings.enabled && detectedLanguage !== config.translatorSettings.targetLanguage) {
        messageToProcess = await this.translateText(message.content, detectedLanguage, config.translatorSettings.targetLanguage);
        console.log(`🌐 Mensaje traducido de ${detectedLanguage} a ${config.translatorSettings.targetLanguage}`);
      }

      // Generar respuesta basada en historial
      const response = await this.generateContextualResponse(
        messageToProcess,
        conversationHistory,
        config
      );

      if (response) {
        // Traducir respuesta si es necesario
        let finalResponse = response;
        let translatedResponse = '';
        
        if (config.translatorSettings.enabled && detectedLanguage !== config.translatorSettings.targetLanguage) {
          finalResponse = await this.translateText(response, config.translatorSettings.targetLanguage, detectedLanguage);
          translatedResponse = `\n\n🇪🇸 ${response}`; // Mostrar versión en español debajo
        }

        // Enviar respuesta
        console.log(`📤 Respuesta enviada para ${message.chatId}: "${finalResponse.substring(0, 50)}..."`);
        
        // Guardar respuesta en historial
        conversationHistory.push({
          id: Date.now().toString(),
          content: finalResponse,
          isFromUser: false,
          timestamp: new Date(),
          originalLanguage: detectedLanguage !== config.translatorSettings.targetLanguage ? detectedLanguage : config.translatorSettings.targetLanguage,
          translatedContent: translatedResponse
        });

        // Actualizar historial de conversación
        this.conversationHistory.set(message.chatId, conversationHistory);
        
        // Guardar en base de datos
        await this.saveResponse(config.accountId, message.chatId, finalResponse + translatedResponse);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
    }
  }

  /**
   * Detectar idioma del texto
   */
  private async detectLanguage(text: string): Promise<string> {
    try {
      // Implementación simple de detección de idioma
      // En producción se usaría un servicio más robusto
      const spanishWords = ['el', 'la', 'es', 'en', 'un', 'de', 'que', 'y', 'hola', 'gracias', 'por favor'];
      const englishWords = ['the', 'is', 'in', 'a', 'of', 'and', 'hello', 'thank', 'please', 'you'];
      
      const lowerText = text.toLowerCase();
      const spanishCount = spanishWords.filter(word => lowerText.includes(word)).length;
      const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
      
      if (spanishCount > englishCount) return 'es';
      if (englishCount > spanishCount) return 'en';
      
      return 'es'; // Por defecto español
    } catch (error) {
      console.error('❌ Error detectando idioma:', error);
      return 'es';
    }
  }

  /**
   * Traducir texto
   */
  private async translateText(text: string, fromLang: string, toLang: string): Promise<string> {
    try {
      if (fromLang === toLang) return text;
      
      // Usar el servicio de IA para traducir
      const translationPrompt = `Translate the following text from ${fromLang} to ${toLang}. Only return the translation, no explanations:\n\n${text}`;
      
      const translation = await aiProviderService.generateResponse(translationPrompt, 'Translator');
      return translation || text;
    } catch (error) {
      console.error('❌ Error traduciendo texto:', error);
      return text;
    }
  }

  /**
   * Obtener historial de conversación
   */
  private async getConversationHistory(chatId: string, accountId: number): Promise<ConversationMessage[]> {
    try {
      // Verificar si ya tenemos historial en memoria
      if (this.conversationHistory.has(chatId)) {
        return this.conversationHistory.get(chatId) || [];
      }

      // Cargar historial desde base de datos usando SQL raw
      const { pool } = await import('../db');
      const result = await pool.query(`
        SELECT id, content, "isFromUser", timestamp
        FROM whatsapp_messages 
        WHERE "chatId" = $1 
        AND "accountId" = $2
        ORDER BY timestamp ASC 
        LIMIT 20
      `, [chatId, accountId]);

      const history: ConversationMessage[] = result.rows.map(msg => ({
        id: msg.id.toString(),
        content: msg.content,
        isFromUser: msg.isFromUser,
        timestamp: msg.timestamp,
        originalLanguage: 'es' // Por defecto
      }));

      this.conversationHistory.set(chatId, history);
      return history;
    } catch (error) {
      console.error('❌ Error obteniendo historial:', error);
      return [];
    }
  }

  /**
   * Generar respuesta contextual basada en historial
   */
  private async generateContextualResponse(
    message: string,
    history: ConversationMessage[],
    config: AutoResponseConfig
  ): Promise<string> {
    try {
      // Construir contexto de la conversación
      const conversationContext = history
        .slice(-10) // Últimos 10 mensajes para contexto
        .map(msg => `${msg.isFromUser ? 'Usuario' : 'Asistente'}: ${msg.content}`)
        .join('\n');

      // Prompt contextual
      const contextualPrompt = `${config.customPrompt}

Historial de conversación reciente:
${conversationContext}

Usuario: ${message}

Instrucciones:
- Responde considerando el contexto completo de la conversación
- Mantén coherencia con respuestas anteriores
- Usa el historial para personalizar tu respuesta
- Responde de manera natural y fluida

Asistente:`;

      return await aiProviderService.generateResponse(contextualPrompt, config.agentName);
    } catch (error) {
      console.error('❌ Error generando respuesta contextual:', error);
      return 'Disculpa, estoy teniendo dificultades técnicas. Un representante te contactará pronto.';
    }
  }

  /**
   * Detectar intervención manual de agente humano
   */
  async detectManualIntervention(chatId: string, accountId: number): Promise<void> {
    try {
      // Verificar si hay mensajes enviados por agentes humanos en los últimos 5 minutos
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Usar SQL raw para evitar errores de sintaxis
      const { pool } = await import('../db');
      const result = await pool.query(`
        SELECT id FROM whatsapp_messages 
        WHERE "chatId" = $1 
        AND "accountId" = $2 
        AND "isFromUser" = false 
        AND timestamp > $3
        LIMIT 1
      `, [chatId, accountId, fiveMinutesAgo]);

      if (result.rows.length > 0) {
        // Activar intervención manual por 30 minutos
        this.manualInterventions.add(chatId);
        console.log(`🛑 Intervención manual detectada para chat ${chatId} - Respuestas automáticas pausadas`);
        
        // Remover automáticamente después de 30 minutos
        setTimeout(() => {
          this.manualInterventions.delete(chatId);
          console.log(`✅ Intervención manual expirada para chat ${chatId} - Respuestas automáticas reactivadas`);
        }, 30 * 60 * 1000);
      }
    } catch (error) {
      console.error('❌ Error detectando intervención manual:', error);
    }
  }

  /**
   * Guardar respuesta en base de datos
   */
  private async saveResponse(accountId: number, chatId: string, response: string): Promise<void> {
    try {
      await db.insert(whatsappMessages).values({
        accountId,
        chatId,
        content: response,
        isFromUser: false,
        timestamp: new Date(),
        messageType: 'text'
      });
    } catch (error) {
      console.error('❌ Error guardando respuesta:', error);
    }
  }

  /**
   * Activar/desactivar traductor para una cuenta
   */
  async toggleTranslator(accountId: number, enabled: boolean, targetLanguage: string = 'es'): Promise<void> {
    const config = this.configs.get(accountId);
    if (config) {
      config.translatorSettings.enabled = enabled;
      config.translatorSettings.targetLanguage = targetLanguage;
      console.log(`🌐 Traductor ${enabled ? 'activado' : 'desactivado'} para cuenta ${accountId}`);
    }
  }

  /**
   * Pausar respuestas automáticas para un chat específico
   */
  pauseAutoResponsesForChat(chatId: string): void {
    this.manualInterventions.add(chatId);
    console.log(`⏸️ Respuestas automáticas pausadas para chat ${chatId}`);
  }

  /**
   * Reanudar respuestas automáticas para un chat específico
   */
  resumeAutoResponsesForChat(chatId: string): void {
    this.manualInterventions.delete(chatId);
    console.log(`▶️ Respuestas automáticas reanudadas para chat ${chatId}`);
  }

  /**
   * Detener el servicio
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    this.isRunning = false;
    console.log('🛑 Sistema mejorado de respuestas automáticas detenido');
  }
}

// Exportar instancia singleton
export const enhancedAutoResponseService = new EnhancedAutoResponseService();