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
  accountId?: number;
  lastProcessedMessageId?: string;
}

// Estado global de configuraciones de A.E AI por chat
const activeConfigs = new Map<string, AutoResponseConfig>();

export class WhatsAppAutoResponder {
  
  /**
   * Activa A.E AI para un chat específico
   */
  static activateForChat(chatId: string, agentName: string = "A.E AI Smartbots", accountId?: number): void {
    activeConfigs.set(chatId, {
      chatId,
      isActive: true,
      agentName,
      accountId,
      lastProcessedMessageId: undefined
    });
    console.log(`🟢 A.E AI activado para chat ${chatId} con agente: ${agentName}${accountId ? ` (cuenta: ${accountId})` : ''}`);
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
      
      // Obtener prompt personalizado para la cuenta
      let customPrompt = null;
      try {
        const { db } = await import('../drizzle');
        const { whatsappAccounts, aiPrompts } = await import('../../shared/schema');
        const { eq } = await import('drizzle-orm');
        
        // Buscar la cuenta específica por ID de configuración
        if (config.accountId) {
          const accountData = await db.select().from(whatsappAccounts)
            .where(eq(whatsappAccounts.id, config.accountId))
            .limit(1);
          
          if (accountData[0]?.assignedPromptId) {
            const promptData = await db.select().from(aiPrompts)
              .where(eq(aiPrompts.id, accountData[0].assignedPromptId))
              .limit(1);
            
            if (promptData[0]) {
              customPrompt = promptData[0].content;
              console.log(`✅ Usando prompt personalizado: ${promptData[0].name} para cuenta ${config.accountId}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error obteniendo prompt personalizado:`, error);
      }
      
      // Generar respuesta usando prompt personalizado o genérico
      const response = await this.generateResponse(message.body, config.agentName, customPrompt);
      
      if (response) {
        // Marcar mensaje como procesado ANTES de enviar para evitar duplicados
        config.lastProcessedMessageId = message.id;
        
        // Enviar respuesta con el mismo formato que los mensajes normales
        if (whatsappInstance && whatsappInstance.sendMessage) {
          // Crear objeto de mensaje con la estructura estándar
          const autoResponseMessage = {
            id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            body: response,
            fromMe: true,
            timestamp: Math.floor(Date.now() / 1000),
            chatId: message.chatId,
            hasMedia: false,
            type: 'auto_response'
          };
          
          // Enviar usando el método estándar de WhatsApp
          await whatsappInstance.sendMessage(message.chatId, response);
          console.log(`📤 Respuesta A.E AI enviada a ${message.chatId}`);
          console.log(`💬 Respuesta: "${response.substring(0, 100)}..."`);
          
          // Notificar a través de WebSocket para actualización en tiempo real
          try {
            const { sendWSMessage } = await import('./messageInterceptorService');
            sendWSMessage({
              type: 'MESSAGE_RECEIVED',
              chatId: message.chatId,
              message: autoResponseMessage
            });
          } catch (wsError) {
            console.log('No se pudo notificar vía WebSocket:', wsError.message);
          }
          
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
   * Genera respuesta usando múltiples proveedores de IA con sistema de respaldo
   */
  private static async generateResponse(messageText: string, agentName: string, customPrompt?: string): Promise<string | null> {
    const providers = [
      { name: 'Gemini', method: 'generateResponseWithGemini' },
      { name: 'Qwen3', method: 'generateResponseWithQwen3' },
      { name: 'DeepSeek', method: 'generateResponseWithDeepSeek' },
      { name: 'OpenAI', method: 'generateResponseWithOpenAI' }
    ];

    for (const provider of providers) {
      try {
        console.log(`🔗 Intentando con ${provider.name}...`);
        const response = await this[provider.method](messageText, agentName, customPrompt);
        if (response) {
          console.log(`✅ Respuesta generada exitosamente por ${agentName} usando ${provider.name}`);
          return response;
        }
      } catch (error) {
        console.log(`❌ Error con ${provider.name}, probando siguiente proveedor...`);
        continue;
      }
    }

    console.error('❌ Todos los proveedores de IA fallaron');
    return null;
  }

  /**
   * Genera respuesta usando Gemini
   */
  private static async generateResponseWithGemini(messageText: string, agentName: string, customPrompt?: string): Promise<string | null> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = customPrompt || `Eres ${agentName}, un asistente inteligente especializado en atención al cliente.

Características:
- Respondes de manera clara, útil y empática
- Mantienes un tono conversacional pero profesional
- Ofreces soluciones específicas y prácticas
- Respondes en español de forma concisa (máximo 3 líneas)
- Si no puedes resolver algo, ofreces derivar con un agente humano

Mensaje del cliente: ${messageText}`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Error con Gemini:', error);
      throw error;
    }
  }

  /**
   * Genera respuesta usando Qwen3
   */
  private static async generateResponseWithQwen3(messageText: string, agentName: string, customPrompt?: string): Promise<string | null> {
    try {
      const systemContent = customPrompt || `Eres ${agentName}, un asistente inteligente especializado en atención al cliente.

Características:
- Respondes de manera clara, útil y empática
- Mantienes un tono conversacional pero profesional
- Ofreces soluciones específicas y prácticas
- Respondes en español de forma concisa (máximo 3 líneas)
- Si no puedes resolver algo, ofreces derivar con un agente humano`;

      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QWEN3_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-72B-Instruct',
          messages: [
            {
              role: 'system',
              content: systemContent
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

      if (!response.ok) throw new Error('Qwen3 API error');
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error con Qwen3:', error);
      throw error;
    }
  }

  /**
   * Genera respuesta usando DeepSeek
   */
  private static async generateResponseWithDeepSeek(messageText: string, agentName: string, customPrompt?: string): Promise<string | null> {
    try {
      const systemContent = customPrompt || `Eres ${agentName}, un asistente inteligente especializado en atención al cliente.

Características:
- Respondes de manera clara, útil y empática
- Mantienes un tono conversacional pero profesional
- Ofreces soluciones específicas y prácticas
- Respondes en español de forma concisa (máximo 3 líneas)
- Si no puedes resolver algo, ofreces derivar con un agente humano`;

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: systemContent
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

      if (!response.ok) throw new Error('DeepSeek API error');
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error con DeepSeek:', error);
      throw error;
    }
  }

  /**
   * Genera respuesta usando OpenAI (método original como respaldo)
   */
  private static async generateResponseWithOpenAI(messageText: string, agentName: string, customPrompt?: string): Promise<string | null> {
    try {
      const openaiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        throw new Error('No hay clave API de OpenAI disponible');
      }
      
      const systemContent = customPrompt || `Eres ${agentName}, un asistente virtual inteligente y profesional de atención al cliente.
              
              Características:
              - Respondes de manera clara, útil y empática
              - Mantienes un tono conversacional pero profesional
              - Ofreces soluciones específicas y prácticas
              - Respondes en español de forma concisa (máximo 3 líneas)
              - Si no puedes resolver algo, ofreces derivar con un agente humano`;
      
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
              content: systemContent
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
      return data.choices[0].message.content;
      
    } catch (error) {
      console.error('Error con OpenAI:', error);
      throw error;
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