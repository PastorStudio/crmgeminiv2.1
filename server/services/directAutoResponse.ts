/**
 * Sistema de respuestas automáticas DIRECTO
 * Sin complicaciones, sin interceptaciones, solo funciona
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts, externalAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DirectMessage {
  accountId: number;
  chatId: string;
  messageText: string;
  fromMe: boolean;
}

export class DirectAutoResponse {
  /**
   * Función principal - recibe mensaje y genera respuesta automática
   */
  static async processMessage(message: DirectMessage): Promise<boolean> {
    try {
      console.log(`🚀 RESPUESTA DIRECTA - Mensaje: "${message.messageText}"`);
      
      // Si el mensaje es nuestro, ignorar
      if (message.fromMe) {
        console.log('⏭️ Mensaje propio, ignorando');
        return false;
      }
      
      // Buscar configuración de la cuenta directamente
      const accountConfig = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, message.accountId))
        .limit(1);
      
      if (accountConfig.length === 0) {
        console.log('❌ Cuenta no encontrada');
        return false;
      }
      
      const account = accountConfig[0];
      
      // Verificar si tiene respuestas automáticas activadas
      if (!account.autoResponseEnabled) {
        console.log('⏭️ Respuestas automáticas no activadas');
        return false;
      }
      
      // Verificar si tiene agente asignado
      if (!account.assignedExternalAgentId) {
        console.log('⏭️ No hay agente externo asignado');
        return false;
      }
      
      const agentId = account.assignedExternalAgentId;
      
      // Buscar información del agente
      const agentInfo = await db.select()
        .from(externalAgents)
        .where(eq(externalAgents.id, agentId))
        .limit(1);
      
      if (agentInfo.length === 0) {
        console.log('❌ Agente externo no encontrado');
        return false;
      }
      
      const agent = agentInfo[0];
      console.log(`🤖 Generando respuesta con ${agent.agentName}...`);
      
      // Generar respuesta usando OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // newest OpenAI model
        messages: [
          {
            role: "system",
            content: `Eres ${agent.agentName}, un asistente especializado en atención al cliente. 
                     Responde de manera amigable, profesional y útil. 
                     Mantén las respuestas concisas pero informativas.`
          },
          {
            role: "user",
            content: message.messageText
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });
      
      const responseText = response.choices[0]?.message?.content;
      
      if (!responseText) {
        console.log('❌ No se pudo generar respuesta');
        return false;
      }
      
      console.log(`✅ Respuesta generada: "${responseText}"`);
      
      // TODO: Aquí conectaremos con WhatsApp para enviar la respuesta
      // Por ahora, solo logueamos que la respuesta está lista
      console.log(`📤 RESPUESTA LISTA PARA ENVÍO al chat ${message.chatId}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error en respuesta directa:', error);
      return false;
    }
  }
  
  /**
   * Verificar si una cuenta tiene respuestas automáticas activas
   */
  static async hasAutoResponseActive(accountId: number): Promise<boolean> {
    try {
      const account = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);
      
      if (account.length === 0) return false;
      
      const acc = account[0];
      return acc.autoResponseEnabled && acc.assignedExternalAgentId;
    } catch (error) {
      console.error('Error verificando auto-respuesta:', error);
      return false;
    }
  }
}

export default DirectAutoResponse;