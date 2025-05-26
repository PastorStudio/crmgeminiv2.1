/**
 * Sistema simple de respuestas automáticas
 * Detecta mensaje "ÚLTIMO RECIBIDO" -> Envía al agente externo -> Responde automáticamente
 */

import { db } from "../db";
import { whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

export class SimpleAutoResponseSystem {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3000; // 3 segundos

  /**
   * Inicia el sistema simple
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 Sistema simple ya está ejecutándose");
      return;
    }

    console.log("🚀 Iniciando sistema simple de respuestas automáticas...");
    this.isRunning = true;

    // Inicia el bucle de verificación
    this.intervalId = setInterval(async () => {
      await this.checkAndRespond();
    }, this.CHECK_INTERVAL);

    console.log(`✅ Sistema simple iniciado - verificando cada ${this.CHECK_INTERVAL / 1000} segundos`);
  }

  /**
   * Detiene el sistema
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("⏹️ Sistema simple detenido");
  }

  /**
   * Función principal: Verifica y responde automáticamente
   */
  private async checkAndRespond(): Promise<void> {
    try {
      // 1. Obtener cuentas con AI ON (autoResponseEnabled = true)
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      if (accounts.length === 0) {
        return; // No hay cuentas con AI activado
      }

      console.log(`🔍 Verificando ${accounts.length} cuentas con AI ON...`);

      for (const account of accounts) {
        await this.processAccount(account);
      }
    } catch (error) {
      console.error("❌ Error en sistema simple:", error);
    }
  }

  /**
   * Procesa una cuenta específica
   */
  private async processAccount(account: any): Promise<void> {
    try {
      // Verificar que tenga agente asignado
      if (!account.assignedExternalAgentId) {
        console.log(`⚠️ Cuenta ${account.name} no tiene agente asignado`);
        return;
      }

      // 1. Obtener chats de WhatsApp
      const chatsResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${account.id}/chats`);
      if (!chatsResponse.ok) {
        console.log(`⚠️ No se pudieron obtener chats para cuenta ${account.name}`);
        return;
      }

      const chats = await chatsResponse.json();
      if (!chats || chats.length === 0) {
        return;
      }

      // 2. Buscar mensajes con "ÚLTIMO RECIBIDO"
      for (const chat of chats) {
        await this.checkChatForLastMessage(account, chat);
      }
    } catch (error) {
      console.error(`❌ Error procesando cuenta ${account.name}:`, error);
    }
  }

  /**
   * Verifica un chat específico buscando el mensaje "ÚLTIMO RECIBIDO"
   */
  private async checkChatForLastMessage(account: any, chat: any): Promise<void> {
    try {
      // Obtener mensajes del chat
      const messagesResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${account.id}/messages/${chat.id}`);
      if (!messagesResponse.ok) {
        return;
      }

      const messages = await messagesResponse.json();
      if (!messages || messages.length === 0) {
        return;
      }

      // Buscar el mensaje más reciente que NO sea nuestro (fromMe: false) y tenga contenido
      const lastReceivedMessage = messages.find((msg: any) => !msg.fromMe && msg.body?.trim());

      if (!lastReceivedMessage) {
        return; // No hay mensajes recibidos
      }

      console.log(`📨 ÚLTIMO RECIBIDO detectado en ${chat.name || chat.id}: "${lastReceivedMessage.body}"`);

      // 3. Enviar al agente externo y obtener respuesta
      const agentResponse = await this.sendToExternalAgent(
        account.assignedExternalAgentId,
        lastReceivedMessage.body,
        chat.name || chat.id
      );

      if (agentResponse) {
        // 4. Enviar respuesta automática por WhatsApp
        await this.sendWhatsAppResponse(account.id, chat.id, agentResponse, chat.name || chat.id);
      }
    } catch (error) {
      console.error(`❌ Error verificando chat ${chat.id}:`, error);
    }
  }

  /**
   * Envía mensaje al agente externo y obtiene respuesta
   */
  private async sendToExternalAgent(agentId: string, message: string, contactName: string): Promise<any> {
    try {
      console.log(`🤖 Enviando a agente ${agentId}: "${message}"`);

      // Usar HTTP nativo para obtener la respuesta exacta del agente
      const http = require('http');
      
      const postData = JSON.stringify({
        message: message,
        contactName: contactName
      });

      const options = {
        hostname: 'localhost',
        port: 5000,
        path: `/api/external-agents/${agentId}/generate-response`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const agentResponse = await new Promise<string>((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode !== 200) {
              console.log(`⚠️ Agente no disponible - Status: ${res.statusCode}`);
              resolve('');
            } else {
              resolve(data);
            }
          });
        });

        req.on('error', (error) => {
          console.error(`❌ Error conectando con agente:`, error);
          resolve('');
        });

        req.write(postData);
        req.end();
      });

      if (!agentResponse || agentResponse.trim().length === 0) {
        console.log(`❌ Sin respuesta del agente ${agentId}`);
        return null;
      }

      // Limpiar la respuesta del agente si contiene HTML
      let cleanResponse = agentResponse;
      
      if (agentResponse.includes('<') && agentResponse.includes('>')) {
        cleanResponse = agentResponse
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Formato final: respuesta del agente + nombre del usuario
      const finalResponse = `${cleanResponse} - ${contactName}`;
      
      console.log(`✅ Respuesta del agente: "${cleanResponse}"`);
      console.log(`✅ Respuesta final con nombre: "${finalResponse}"`);
      
      return finalResponse;
    } catch (error) {
      console.error(`❌ Error llamando al agente externo:`, error);
      return null;
    }
  }

  /**
   * Envía respuesta automática por WhatsApp (soporta texto e imágenes)
   */
  private async sendWhatsAppResponse(accountId: number, chatId: string, response: string, contactName: string): Promise<void> {
    try {
      // Si es string, convertir a formato JSON básico
      if (typeof response === 'string') {
        response = { type: 'text', content: response };
      }

      // Manejar diferentes tipos de respuesta
      if (response.type === 'text' || !response.type) {
        // Respuesta de texto
        const sendResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: chatId,
            message: response.content || response.text || response
          })
        });

        if (sendResponse.ok) {
          console.log(`✅ RESPUESTA AUTOMÁTICA (texto) ENVIADA a ${contactName}: "${response.content || response.text || response}"`);
        } else {
          console.log(`⚠️ Error enviando respuesta de texto a ${contactName}`);
        }
      } 
      else if (response.type === 'image') {
        // Respuesta de imagen
        const sendResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: chatId,
            mediaUrl: response.url || response.image_url,
            caption: response.caption || response.text || '',
            type: 'image'
          })
        });

        if (sendResponse.ok) {
          console.log(`✅ RESPUESTA AUTOMÁTICA (imagen) ENVIADA a ${contactName}: ${response.url || response.image_url}`);
        } else {
          console.log(`⚠️ Error enviando respuesta de imagen a ${contactName}`);
        }
      }
      else if (response.type === 'multimedia' || Array.isArray(response.content)) {
        // Respuesta multimedia (múltiples mensajes)
        const messages = Array.isArray(response.content) ? response.content : [response];
        
        for (const msg of messages) {
          await this.sendWhatsAppResponse(accountId, chatId, msg, contactName);
          // Pequeña pausa entre mensajes
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      else {
        // Formato desconocido, enviar como texto
        const textContent = response.content || response.message || response.text || JSON.stringify(response);
        const sendResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: chatId,
            message: textContent
          })
        });

        if (sendResponse.ok) {
          console.log(`✅ RESPUESTA AUTOMÁTICA (formato genérico) ENVIADA a ${contactName}: "${textContent}"`);
        } else {
          console.log(`⚠️ Error enviando respuesta genérica a ${contactName}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error enviando respuesta automática:`, error);
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.CHECK_INTERVAL,
    };
  }
}

// Instancia singleton
export const simpleAutoResponseSystem = new SimpleAutoResponseSystem();