/**
 * Motor de respuestas automáticas en tiempo real
 * Este sistema monitorea mensajes nuevos y genera respuestas automáticas usando AI
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AutoResponseEngine {
  constructor() {
    this.isActive = false;
    this.configs = new Map(); // chatId -> config
    this.processedMessages = new Set();
    this.lastMessageCounts = new Map(); // chatId -> count
    this.gemini = null;
    this.checkInterval = null;
    
    this.initializeAI();
  }

  async initializeAI() {
    try {
      if (process.env.GEMINI_API_KEY) {
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('🤖 Gemini AI inicializado para respuestas automáticas');
      }
    } catch (error) {
      console.error('❌ Error inicializando AI:', error);
    }
  }

  setConfig(chatId, accountId, config) {
    console.log(`🎛️ Configurando respuestas automáticas para chat ${chatId}:`, config);
    this.configs.set(chatId, { ...config, accountId });
    
    if (config.enabled && !this.isActive) {
      this.startMonitoring();
    } else if (!config.enabled && this.configs.size === 0) {
      this.stopMonitoring();
    }
  }

  startMonitoring() {
    if (this.isActive) return;
    
    console.log('🚀 Iniciando monitoreo de respuestas automáticas...');
    this.isActive = true;
    
    // Verificar mensajes nuevos cada 20 segundos
    this.checkInterval = setInterval(() => {
      this.checkForNewMessages();
    }, 20000);
  }

  stopMonitoring() {
    if (!this.isActive) return;
    
    console.log('⏹️ Deteniendo monitoreo de respuestas automáticas...');
    this.isActive = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkForNewMessages() {
    if (!this.isActive) return;

    console.log('🔍 Verificando mensajes nuevos para respuestas automáticas...');
    
    for (const [chatId, config] of this.configs.entries()) {
      if (!config.enabled) continue;
      
      try {
        await this.processChat(chatId, config);
      } catch (error) {
        console.error(`❌ Error procesando chat ${chatId}:`, error);
      }
    }
  }

  // Activar automáticamente el sistema para un chat específico
  activateForChat(chatId, accountId) {
    const defaultConfig = {
      enabled: true,
      provider: 'gemini',
      timing: '30sec',
      style: 'dynamic',
      humanity: 3,
      length: 'medium',
      instructions: 'Responde de manera amigable y profesional'
    };
    
    console.log(`🚀 Activando respuestas automáticas para chat ${chatId}`);
    this.setConfig(chatId, accountId, defaultConfig);
    return defaultConfig;
  }

  async processChat(chatId, config) {
    try {
      // Obtener mensajes del chat
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${config.accountId}/messages/${chatId}`);
      const messages = await response.json();
      
      if (!messages || messages.length === 0) return;

      // Verificar si hay mensajes nuevos
      const lastCount = this.lastMessageCounts.get(chatId) || 0;
      const currentCount = messages.length;
      
      if (currentCount <= lastCount) return;

      console.log(`📬 Detectados ${currentCount - lastCount} mensajes nuevos en chat ${chatId}`);
      this.lastMessageCounts.set(chatId, currentCount);

      // Procesar solo mensajes muy recientes (últimos 30 minutos)
      const recentMessages = messages.filter(msg => {
        const messageTime = new Date(msg.timestamp);
        const now = new Date();
        const diffMinutes = (now - messageTime) / (1000 * 60);
        return diffMinutes <= 30 && !msg.fromMe && !this.processedMessages.has(msg.id);
      });

      for (const message of recentMessages) {
        await this.processMessage(message, chatId, config);
      }

    } catch (error) {
      console.error(`❌ Error procesando chat ${chatId}:`, error);
    }
  }

  async processMessage(message, chatId, config) {
    try {
      // Marcar mensaje como procesado
      this.processedMessages.add(message.id);
      
      console.log(`🤖 Generando respuesta automática para mensaje: "${message.body?.substring(0, 50)}..."`);

      // Aplicar retraso según configuración
      const delay = this.getResponseDelay(config.timing);
      if (delay > 0) {
        console.log(`⏰ Esperando ${delay / 1000} segundos antes de responder...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Generar respuesta con AI
      const response = await this.generateResponse(message, config);
      
      if (response) {
        // Enviar respuesta
        await this.sendResponse(chatId, response, config);
        console.log(`✅ Respuesta automática enviada: "${response.substring(0, 50)}..."`);
      }

    } catch (error) {
      console.error(`❌ Error procesando mensaje ${message.id}:`, error);
    }
  }

  getResponseDelay(timing) {
    const delays = {
      'immediate': 0,
      '30sec': 30000,
      '1min': 60000,
      '2min': 120000,
      '5min': 300000
    };
    return delays[timing] || 0;
  }

  async generateResponse(message, config) {
    if (!this.gemini) {
      console.log('⚠️ AI no disponible, usando respuesta predeterminada');
      return 'Gracias por tu mensaje. Te responderemos pronto.';
    }

    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = this.buildPrompt(message, config);
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return text.trim();

    } catch (error) {
      console.error('❌ Error generando respuesta AI:', error);
      return 'Gracias por contactarnos. Te responderemos a la brevedad.';
    }
  }

  buildPrompt(message, config) {
    let prompt = `Eres un asistente de atención al cliente. Responde al siguiente mensaje de manera ${config.style === 'precise' ? 'precisa y profesional' : 'natural y dinámica'}.

Mensaje del cliente: "${message.body}"

Instrucciones:
- Nivel de humanidad: ${config.humanity}/5 (1=muy formal, 5=muy humano)
- Longitud: ${config.length} (corto=1-2 líneas, medio=2-3 líneas, largo=3-4 líneas)
- Idioma: español
- Tono: amigable y servicial`;

    if (config.instructions) {
      prompt += `\n- Instrucciones especiales: ${config.instructions}`;
    }

    prompt += '\n\nRespuesta:';
    return prompt;
  }

  async sendResponse(chatId, responseText, config) {
    try {
      // Intentar enviar a través de la API de WhatsApp
      const sendResponse = await fetch('http://localhost:5000/api/direct/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatId,
          message: responseText
        })
      });

      if (sendResponse.ok) {
        console.log('📤 Mensaje enviado exitosamente via API directa');
      } else {
        console.log('⚠️ API directa no disponible, simulando envío');
        // En desarrollo, simular el envío
        this.simulateSentMessage(chatId, responseText);
      }

    } catch (error) {
      console.error('❌ Error enviando respuesta:', error);
      // Fallback: simular envío en desarrollo
      this.simulateSentMessage(chatId, responseText);
    }
  }

  simulateSentMessage(chatId, message) {
    console.log(`📱 [SIMULADO] Enviando a ${chatId}: "${message}"`);
    // En un entorno de desarrollo, esto simula el envío del mensaje
  }

  getStatus() {
    return {
      active: this.isActive,
      configuredChats: this.configs.size,
      processedMessages: this.processedMessages.size,
      hasGemini: !!this.gemini
    };
  }
}

// Singleton instance
const autoResponseEngine = new AutoResponseEngine();

module.exports = autoResponseEngine;