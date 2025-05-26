/**
 * Servicio de respuestas automáticas que utiliza la conexión activa de WhatsApp
 * En lugar de depender de la conexión directa, usa la API activa que ya funciona
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

class ActiveConnectionAutoResponse {
  constructor() {
    this.config = {
      enabled: true,
      delay: 5000, // 5 segundos de delay
      useAI: true,
      defaultMessage: 'Hola {{nombre}}, gracias por tu mensaje. Pronto nos pondremos en contacto contigo.',
      excludedChats: []
    };
    
    this.geminiClient = null;
    this.openaiClient = null;
    this.lastProcessedMessages = new Map(); // Para evitar procesar el mismo mensaje múltiples veces
    
    this.initializeAI();
  }

  async initializeAI() {
    try {
      // Inicializar Gemini
      if (process.env.GEMINI_API_KEY) {
        this.geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini AI inicializado para respuestas automáticas');
      }

      // Inicializar OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI inicializado para respuestas automáticas');
      }
    } catch (error) {
      console.error('❌ Error inicializando AI para respuestas automáticas:', error);
    }
  }

  /**
   * Procesa mensajes nuevos desde la conexión activa
   */
  async processNewMessages(accountId = 1) {
    try {
      if (!this.config.enabled) {
        return;
      }

      console.log('🔄 Verificando mensajes nuevos para respuestas automáticas...');

      // Obtener chats de la conexión activa
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/chats`);
      const chats = await response.json();

      for (const chat of chats) {
        await this.checkChatForNewMessages(accountId, chat);
      }
    } catch (error) {
      console.error('❌ Error procesando mensajes nuevos:', error);
    }
  }

  /**
   * Verifica un chat específico para mensajes nuevos
   */
  async checkChatForNewMessages(accountId, chat) {
    try {
      // Obtener mensajes del chat
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/messages/${chat.id}`);
      const messages = await response.json();

      // Obtener el mensaje más reciente que no sea nuestro
      const latestMessage = messages
        .filter(msg => !msg.fromMe)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      if (!latestMessage) {
        return;
      }

      // Verificar si ya procesamos este mensaje
      const messageKey = `${chat.id}-${latestMessage.id}`;
      if (this.lastProcessedMessages.has(messageKey)) {
        return;
      }

      // Verificar si el mensaje es reciente (últimos 30 minutos)
      const messageTime = new Date(latestMessage.timestamp);
      const now = new Date();
      const diffMinutes = (now - messageTime) / (1000 * 60);

      if (diffMinutes > 30) {
        return; // Mensaje muy antiguo, no responder
      }

      // Marcar como procesado
      this.lastProcessedMessages.set(messageKey, true);

      // Generar y enviar respuesta
      await this.generateAndSendResponse(accountId, chat, latestMessage);

    } catch (error) {
      console.error('❌ Error verificando chat para mensajes nuevos:', error);
    }
  }

  /**
   * Genera y envía una respuesta automática
   */
  async generateAndSendResponse(accountId, chat, message) {
    try {
      console.log(`🤖 Generando respuesta para: ${chat.name || chat.id}`);

      // Obtener nombre del contacto
      const contactName = chat.name || 'cliente';

      // Generar respuesta con AI
      let responseText = '';
      if (this.config.useAI) {
        responseText = await this.generateAIResponse(message.body, contactName);
      } else {
        responseText = this.config.defaultMessage.replace('{{nombre}}', contactName);
      }

      // Simular delay antes de enviar
      setTimeout(async () => {
        try {
          // Enviar mensaje usando la API activa
          await this.sendMessage(accountId, chat.id, responseText);
          console.log(`✅ Respuesta automática enviada a ${contactName}: ${responseText.substring(0, 50)}...`);
        } catch (error) {
          console.error('❌ Error enviando respuesta automática:', error);
        }
      }, this.config.delay);

    } catch (error) {
      console.error('❌ Error generando respuesta automática:', error);
    }
  }

  /**
   * Genera una respuesta usando AI
   */
  async generateAIResponse(messageText, contactName) {
    try {
      // Intentar con Gemini primero
      if (this.geminiClient) {
        try {
          const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
          
          const prompt = `
Eres un asistente profesional que representa a una empresa. 
Responde de manera cordial, clara y concisa.
Personaliza tu respuesta al contexto del mensaje.
Usa el nombre ${contactName} de forma natural.
Mantén tu respuesta breve (máximo 2-3 oraciones).

Mensaje del cliente: "${messageText}"

Tu respuesta:`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          if (text && text.trim()) {
            return text.trim();
          }
        } catch (error) {
          console.log('⚠️ Error con Gemini, intentando OpenAI...');
        }
      }

      // Intentar con OpenAI como respaldo
      if (this.openaiClient) {
        try {
          const completion = await this.openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `Eres un asistente profesional que representa a una empresa. Responde de manera cordial, clara y concisa. Usa el nombre ${contactName} de forma natural.`
              },
              {
                role: "user",
                content: messageText
              }
            ],
            temperature: 0.7,
            max_tokens: 150
          });

          const text = completion.choices[0].message.content;
          if (text && text.trim()) {
            return text.trim();
          }
        } catch (error) {
          console.log('⚠️ Error con OpenAI también');
        }
      }

      // DESHABILITADO: No usar respuestas de fallback, solo usar agente externo
      console.log(`⚠️ ActiveConnection: No se genera respuesta fallback para ${contactName}. Solo usar agente externo.`);
      return null;

    } catch (error) {
      console.error('❌ Error generando respuesta con AI:', error);
      return `Hola ${contactName}, gracias por contactarnos. Te responderemos pronto.`;
    }
  }

  /**
   * Envía un mensaje usando la API activa
   */
  async sendMessage(accountId, chatId, message) {
    try {
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        })
      });

      if (!response.ok) {
        throw new Error(`Error enviando mensaje: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      throw error;
    }
  }

  /**
   * Inicia el monitoreo de mensajes
   */
  startMonitoring(intervalSeconds = 30) {
    console.log(`🚀 Iniciando monitoreo de respuestas automáticas cada ${intervalSeconds} segundos`);
    
    // Procesar inmediatamente
    this.processNewMessages();
    
    // Configurar intervalo
    setInterval(() => {
      this.processNewMessages();
    }, intervalSeconds * 1000);
  }

  /**
   * Habilita o deshabilita el servicio
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    console.log(`📊 Respuestas automáticas ${enabled ? 'habilitadas' : 'deshabilitadas'}`);
  }

  /**
   * Obtiene el estado actual
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      hasGemini: !!this.geminiClient,
      hasOpenAI: !!this.openaiClient,
      processedMessages: this.lastProcessedMessages.size
    };
  }
}

// Crear instancia global
const activeAutoResponse = new ActiveConnectionAutoResponse();

// Iniciar monitoreo automático
activeAutoResponse.startMonitoring(20); // Verificar cada 20 segundos

module.exports = {
  ActiveConnectionAutoResponse,
  activeAutoResponse
};