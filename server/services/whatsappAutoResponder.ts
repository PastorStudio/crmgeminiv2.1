/**
 * Sistema de respuesta automática para WhatsApp usando OpenAI
 * Basado en la lógica del "Probar Agente Intermediario"
 */

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  chatId: string;
  type?: string;
}

interface AutoResponseConfig {
  chatId: string;
  isActive: boolean;
  agentName: string;
  lastProcessedMessageId?: string;
}

// Estado global de configuraciones de A.E AI por chat
const activeConfigs = new Map<string, AutoResponseConfig>();

export class WhatsAppAutoResponder {
  
  /**
   * Activa A.E AI para un chat específico
   */
  static activateForChat(chatId: string, agentName: string = "A.E AI Smartbots"): void {
    activeConfigs.set(chatId, {
      chatId,
      isActive: true,
      agentName,
      lastProcessedMessageId: undefined
    });
    console.log(`🟢 A.E AI activado para chat ${chatId} con agente: ${agentName}`);
  }
  
  /**
   * Desactiva A.E AI para un chat específico
   */
  static deactivateForChat(chatId: string): void {
    const config = activeConfigs.get(chatId);
    if (config) {
      config.isActive = false;
      console.log(`🔴 A.E AI desactivado para chat ${chatId}`);
    }
  }
  
  /**
   * Verifica si A.E AI está activo para un chat
   */
  static isActiveForChat(chatId: string): boolean {
    const config = activeConfigs.get(chatId);
    return config?.isActive === true;
  }
  
  /**
   * Procesa un mensaje entrante y genera respuesta automática si es necesario
   */
  static async processIncomingMessage(
    message: WhatsAppMessage,
    whatsappInstance?: any
  ): Promise<boolean> {
    
    // Verificar si A.E AI está activo para este chat
    if (!this.isActiveForChat(message.chatId)) {
      return false;
    }
    
    // No procesar mensajes propios
    if (message.fromMe) {
      return false;
    }
    
    const config = activeConfigs.get(message.chatId);
    if (!config) {
      return false;
    }
    
    // Verificar si ya procesamos este mensaje
    if (config.lastProcessedMessageId === message.id) {
      console.log(`🚫 Mensaje ya procesado: ${message.id}`);
      return false;
    }
    
    // Verificar que el mensaje sea reciente (últimos 2 minutos)
    const messageAge = Date.now() - message.timestamp;
    const twoMinutes = 2 * 60 * 1000;
    
    if (messageAge > twoMinutes) {
      console.log(`🚫 Mensaje muy antiguo: ${message.id} (${Math.round(messageAge/1000)}s)`);
      return false;
    }
    
    try {
      console.log(`🤖 Procesando mensaje para A.E AI en chat ${message.chatId}`);
      console.log(`💬 Mensaje: "${message.body}"`);
      
      // Generar respuesta usando la misma lógica que "Probar Agente Intermediario"
      const response = await this.generateResponse(message.body, config.agentName);
      
      if (response) {
        // Marcar mensaje como procesado ANTES de enviar para evitar duplicados
        config.lastProcessedMessageId = message.id;
        
        // Enviar respuesta
        if (whatsappInstance && whatsappInstance.sendMessage) {
          await whatsappInstance.sendMessage(message.chatId, response);
          console.log(`📤 Respuesta A.E AI enviada a ${message.chatId}`);
          console.log(`💬 Respuesta: "${response.substring(0, 100)}..."`);
        } else {
          console.log(`📝 Respuesta A.E AI generada (simulación): "${response.substring(0, 100)}..."`);
        }
        
        return true;
      }
      
    } catch (error) {
      console.error(`❌ Error procesando mensaje A.E AI para chat ${message.chatId}:`, error);
    }
    
    return false;
  }
  
  /**
   * Genera respuesta usando OpenAI (misma lógica que Probar Agente Intermediario)
   */
  private static async generateResponse(messageText: string, agentName: string): Promise<string | null> {
    try {
      // Verificar clave API (usar la misma variable que en frontend)
      const openaiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.log(`❌ No hay clave API de OpenAI disponible`);
        return null;
      }
      
      console.log(`🔗 Conectando directamente con OpenAI API`);
      console.log(`🎯 Agente: ${agentName}`);
      
      // Hacer la misma llamada que en "Probar Agente Intermediario"
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Eres ${agentName}, un asistente virtual inteligente y profesional de atención al cliente.
              
              Características:
              - Respondes de manera clara, útil y empática
              - Mantienes un tono conversacional pero profesional
              - Ofreces soluciones específicas y prácticas
              - Respondes en español de forma concisa (máximo 3 líneas)
              - Si no puedes resolver algo, ofreces derivar con un agente humano`
            },
            {
              role: 'user',
              content: messageText
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error de OpenAI API');
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      console.log(`✅ Respuesta generada exitosamente por ${agentName}`);
      return aiResponse;
      
    } catch (error) {
      console.error(`❌ Error generando respuesta con OpenAI:`, error);
      return null;
    }
  }
  
  /**
   * Obtiene lista de chats con A.E AI activo
   */
  static getActiveChats(): AutoResponseConfig[] {
    return Array.from(activeConfigs.values()).filter(config => config.isActive);
  }
  
  /**
   * Limpia configuraciones antiguas para evitar acumulación en memoria
   */
  static cleanup(): void {
    if (activeConfigs.size > 50) {
      console.log(`🧹 Limpiando configuraciones A.E AI antiguas...`);
      // Mantener solo las últimas 30 configuraciones activas
      const entries = Array.from(activeConfigs.entries());
      const activeEntries = entries.filter(([_, config]) => config.isActive).slice(-30);
      
      activeConfigs.clear();
      activeEntries.forEach(([chatId, config]) => {
        activeConfigs.set(chatId, config);
      });
    }
  }
}

// Limpieza automática cada hora
setInterval(() => {
  WhatsAppAutoResponder.cleanup();
}, 60 * 60 * 1000);