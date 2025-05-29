/**
 * Sistema de respuestas automáticas simplificado
 * Funciona directamente con la base de datos existente
 */

import { db } from '../db';
import OpenAI from 'openai';

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class SimpleAutoResponseService {
  
  /**
   * Asignar agente externo a cuenta de WhatsApp
   */
  static async assignAgentToAccount(accountId: number, agentId: string): Promise<boolean> {
    try {
      console.log(`🔧 Asignando agente ${agentId} a cuenta ${accountId}`);
      
      // Actualizar la cuenta de WhatsApp con el agente asignado
      const result = await db.execute(`
        UPDATE whatsapp_accounts 
        SET assigned_external_agent_id = $1, auto_response_enabled = true 
        WHERE id = $2
      `, [agentId, accountId]);
      
      console.log('✅ Agente asignado exitosamente');
      return true;
      
    } catch (error) {
      console.error('❌ Error asignando agente:', error);
      return false;
    }
  }

  /**
   * Obtener configuración de agente para una cuenta
   */
  static async getAccountAgentConfig(accountId: number) {
    try {
      const result = await db.execute(`
        SELECT 
          wa.assigned_external_agent_id,
          wa.auto_response_enabled,
          ea.agent_name,
          ea.agent_url
        FROM whatsapp_accounts wa
        LEFT JOIN external_agents ea ON wa.assigned_external_agent_id = ea.id
        WHERE wa.id = $1
      `, [accountId]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      console.error('❌ Error obteniendo configuración:', error);
      return null;
    }
  }

  /**
   * Generar respuesta automática usando OpenAI
   */
  static async generateAutoResponse(
    messageText: string, 
    agentName: string, 
    chatContext?: string
  ): Promise<string> {
    try {
      console.log(`🤖 Generando respuesta automática con ${agentName}`);
      
      const systemPrompt = `Eres ${agentName}, un asistente especializado. 
        Responde de manera profesional, amigable y útil en español.
        Mantén las respuestas concisas y relevantes.
        ${chatContext ? `Contexto del chat: ${chatContext}` : ''}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // el modelo más reciente de OpenAI
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageText }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const autoResponse = response.choices[0].message.content || 'Lo siento, no pude procesar tu mensaje.';
      
      console.log(`✅ Respuesta generada: ${autoResponse.substring(0, 50)}...`);
      return autoResponse;
      
    } catch (error) {
      console.error('❌ Error generando respuesta:', error);
      return 'Lo siento, estoy experimentando dificultades técnicas. Te responderé pronto.';
    }
  }

  /**
   * Procesar mensaje entrante y generar respuesta si está configurado
   */
  static async processIncomingMessage(
    accountId: number, 
    chatId: string, 
    messageText: string,
    fromNumber: string
  ) {
    try {
      console.log(`📨 Procesando mensaje entrante para cuenta ${accountId}`);
      
      // Obtener configuración del agente
      const config = await this.getAccountAgentConfig(accountId);
      
      if (!config || !config.auto_response_enabled || !config.assigned_external_agent_id) {
        console.log('⏭️ Respuesta automática no configurada o desactivada');
        return null;
      }

      console.log(`🎯 Agente activo: ${config.agent_name}`);
      
      // Generar respuesta automática
      const autoResponse = await this.generateAutoResponse(
        messageText,
        config.agent_name,
        `Chat con ${fromNumber}`
      );

      // Enviar respuesta (simulado por ahora)
      console.log(`🚀 Respuesta automática generada: ${autoResponse}`);
      
      // Aquí iría la lógica para enviar el mensaje a WhatsApp
      // Por ahora solo registramos que se generó
      
      return {
        success: true,
        response: autoResponse,
        agentName: config.agent_name
      };
      
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      return null;
    }
  }

  /**
   * Obtener lista de agentes externos disponibles
   */
  static async getAvailableAgents() {
    try {
      const result = await db.execute(`
        SELECT id, agent_name, agent_url, status 
        FROM external_agents 
        WHERE status = 'active'
        ORDER BY agent_name
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.agent_name,
        agentUrl: row.agent_url,
        status: row.status
      }));
      
    } catch (error) {
      console.error('❌ Error obteniendo agentes:', error);
      return [];
    }
  }
}