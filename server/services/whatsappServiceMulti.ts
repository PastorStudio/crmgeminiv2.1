/**
 * Servicio de WhatsApp que utiliza el administrador de múltiples cuentas
 * Permite la gestión de múltiples instancias de WhatsApp simultáneamente
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';
import { storage } from '../storage';
import { WhatsAppChat, WhatsAppMessage, WhatsAppStatus } from './whatsappInterface';

// Servicio para gestión de múltiples cuentas de WhatsApp
const whatsappServiceMulti = {
  /**
   * Inicializa una cuenta de WhatsApp
   * @param accountId ID de la cuenta de WhatsApp
   */
  async initializeAccount(accountId: number): Promise<boolean> {
    try {
      return await whatsappMultiAccountManager.initializeAccount(accountId);
    } catch (error) {
      console.error(`Error inicializando cuenta WhatsApp ID ${accountId}:`, error);
      return false;
    }
  },

  /**
   * Envía un mensaje a través de una cuenta específica de WhatsApp
   * @param accountId ID de la cuenta de WhatsApp
   * @param to Destinatario del mensaje
   * @param body Contenido del mensaje
   * @param options Opciones adicionales para el mensaje
   */
  async sendMessage(accountId: number, to: string, body: string, options: any = {}): Promise<any> {
    try {
      const result = await whatsappMultiAccountManager.sendMessage(accountId, to, body, options);
      
      // Registrar mensaje en la base de datos
      await storage.createMessage({
        leadId: 1, // Por defecto usamos el primer lead, pero podría ser personalizado
        content: body,
        direction: "outgoing", // Mensaje saliente
        channel: "whatsapp",
        read: true
      });
      
      return result;
    } catch (error) {
      console.error(`Error enviando mensaje de WhatsApp desde cuenta ID ${accountId}:`, error);
      throw error;
    }
  },
  
  /**
   * Obtiene el estado de una cuenta de WhatsApp
   * @param accountId ID de la cuenta de WhatsApp
   */
  getStatus(accountId?: number): WhatsAppStatus {
    // Si no se proporciona ID, usar la primera cuenta disponible
    // Esta compatibilidad es para las partes del código que aún no se han adaptado a múltiples cuentas
    if (accountId === undefined) {
      const accounts = whatsappMultiAccountManager.getActiveAccounts();
      if (accounts.length > 0) {
        return whatsappMultiAccountManager.getStatus(accounts[0].id);
      } else {
        return {
          initialized: false,
          ready: false,
          authenticated: false,
          error: 'No hay cuentas de WhatsApp disponibles'
        };
      }
    }
    
    return whatsappMultiAccountManager.getStatus(accountId);
  },
  
  /**
   * Obtiene el código QR más reciente para una cuenta de WhatsApp
   * @param accountId ID de la cuenta de WhatsApp
   */
  async getLatestQR(accountId?: number): Promise<string | null> {
    // Si no se proporciona ID, usar la primera cuenta disponible
    if (accountId === undefined) {
      const accounts = whatsappMultiAccountManager.getActiveAccounts();
      if (accounts.length > 0) {
        return await whatsappMultiAccountManager.getLatestQR(accounts[0].id);
      } else {
        console.error('No hay cuentas de WhatsApp disponibles para generar QR');
        return null;
      }
    }
    
    return await whatsappMultiAccountManager.getLatestQR(accountId);
  },
  
  /**
   * Obtiene los chats disponibles para una cuenta de WhatsApp
   * @param accountId ID de la cuenta de WhatsApp
   */
  async getChats(accountId?: number): Promise<WhatsAppChat[]> {
    // Si no se proporciona ID, usar la primera cuenta disponible
    if (accountId === undefined) {
      const accounts = whatsappMultiAccountManager.getActiveAccounts();
      if (accounts.length > 0) {
        return await whatsappMultiAccountManager.getChats(accounts[0].id);
      } else {
        console.log('No hay cuentas de WhatsApp disponibles para obtener chats');
        return [];
      }
    }
    
    return await whatsappMultiAccountManager.getChats(accountId);
  },
  
  /**
   * Obtiene los mensajes de un chat para una cuenta de WhatsApp
   * @param accountId ID de la cuenta de WhatsApp
   * @param chatId ID del chat
   * @param limit Límite de mensajes a obtener
   */
  async getChatMessages(accountId: number, chatId: string, limit: number = 50): Promise<WhatsAppMessage[]> {
    return await whatsappMultiAccountManager.getChatMessages(accountId, chatId, limit);
  },
  
  /**
   * Desconecta una cuenta de WhatsApp
   * @param accountId ID de la cuenta de WhatsApp
   */
  async disconnectAccount(accountId: number): Promise<boolean> {
    return await whatsappMultiAccountManager.disconnectAccount(accountId);
  },
  
  /**
   * Obtiene información resumida de todas las cuentas activas
   */
  getActiveAccounts(): { id: number, name: string, status: string }[] {
    return whatsappMultiAccountManager.getActiveAccounts();
  },
  
  /**
   * Método para procesar mensajes entrantes y manejar respuestas automáticas
   * @param message Mensaje entrante
   * @param accountId ID de la cuenta de WhatsApp
   */
  async processIncomingMessage(message: any, accountId?: number): Promise<void> {
    try {
      console.log(`📨 Procesando mensaje entrante: "${message.body?.substring(0, 50)}..."`);
      
      // Intentar respuesta con agente externo primero
      if (accountId && !message.fromMe) {
        const { externalAgentWhatsAppIntegrator } = await import('./externalAgentWhatsAppIntegrator');
        
        const whatsappMessage = {
          id: message.id || `msg_${Date.now()}`,
          chatId: message.chatId || message.from,
          accountId: accountId,
          from: message.from || '',
          body: message.body || '',
          timestamp: message.timestamp || Date.now(),
          fromMe: message.fromMe || false,
          contactName: message.contactName
        };

        // Activar respuestas automáticas con agente asignado
        try {
          console.log(`🔍 Verificando agente asignado para cuenta ${accountId}...`);
          
          // Verificar agente asignado en la base de datos
          const { db } = await import('../db');
          const configQuery = await db.execute(`
            SELECT assigned_external_agent_id, auto_response_enabled 
            FROM whatsapp_accounts 
            WHERE id = $1
          `, [accountId]);
          
          if (configQuery.rows.length > 0) {
            const config = configQuery.rows[0];
            console.log(`🎯 Configuración encontrada:`, config);
            
            if (config.assigned_external_agent_id && config.auto_response_enabled) {
              // Obtener información del agente
              const agentQuery = await db.execute(`
                SELECT agent_name FROM external_agents 
                WHERE id = $1
              `, [config.assigned_external_agent_id]);
              
              if (agentQuery.rows.length > 0) {
                const agentName = agentQuery.rows[0].agent_name;
                console.log(`🤖 Generando respuesta automática con ${agentName}...`);
                
                // Generar respuesta usando OpenAI
                const OpenAI = require('openai');
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                
                const systemPrompt = `Eres ${agentName}, un asistente virtual profesional y amigable. 
                Responde de manera útil y conversacional en español. 
                Mantén las respuestas concisas pero informativas.`;
                
                const response = await openai.chat.completions.create({
                  model: "gpt-4o",
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message.body }
                  ],
                  max_tokens: 200,
                  temperature: 0.7,
                });

                const autoResponse = response.choices[0].message.content || 'Lo siento, no pude procesar tu mensaje.';
                
                console.log(`✅ RESPUESTA GENERADA POR ${agentName}: ${autoResponse.substring(0, 50)}...`);
                
                // Enviar respuesta automáticamente
                await this.sendMessage(accountId, message.chatId || message.from, {
                  message: autoResponse,
                  isAutoResponse: true,
                  source: `Agente: ${agentName}`
                });
                
                console.log(`🚀 Respuesta automática enviada exitosamente por ${agentName}`);
                return; // No procesar más si el agente respondió
              }
            } else {
              console.log(`⏭️ Cuenta ${accountId} no tiene respuesta automática activada`);
            }
          } else {
            console.log(`❌ Configuración no encontrada para cuenta ${accountId}`);
          }
        } catch (autoResponseError) {
          console.error('❌ Error en respuesta automática:', autoResponseError);
        }
      }
      
      // Guardar mensaje en la base de datos
      await storage.createMessage({
        leadId: 1, // ID de lead por defecto
        content: message.body || '',
        direction: "incoming", // Mensaje entrante
        channel: "whatsapp",
        read: false
      });
      
      // Importar el servicio de respuestas automáticas
      const { autoResponseService } = await import('./autoResponseManager');
      
      // Procesar respuesta automática si está configurada
      if (autoResponseService) {
        console.log('Enviando mensaje a servicio de respuestas automáticas');
        await autoResponseService.handleIncomingMessage({
          ...message,
          accountId
        });
      } else {
        console.log('Servicio de respuestas automáticas no disponible');
      }
    } catch (error) {
      console.error('Error procesando mensaje entrante:', error);
    }
  }
};

export default whatsappServiceMulti;