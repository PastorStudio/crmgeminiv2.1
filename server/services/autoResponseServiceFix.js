/**
 * Servicio mejorado de respuestas automáticas para WhatsApp
 * 
 * Este archivo corrige los problemas con las respuestas automáticas
 * usando tanto Gemini como OpenAI de manera más confiable.
 */

const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const { getGeminiApiKey, getOpenAIApiKey } = require('./aiKeysManager');
const { GeminiV1Client } = require('./geminiV1');

class AutoResponseServiceFix {
  constructor() {
    this.config = {
      enabled: true,
      aiProvider: "gemini", // o "openai"
      customPrompts: {
        enabled: true,
        system: "Eres un asistente profesional que representa a una empresa. Responde de manera cordial, clara y concisa. Incluye un saludo con el nombre del cliente. Da información específica cuando la tienes, y cuando no, indícales que consultarás con el equipo y te pondrás en contacto pronto.",
        temperature: 0.7,
        maxTokens: 300
      },
      excludedChats: [],
      delaySeconds: 2
    };
    
    this.openaiClient = null;
    this.geminiClient = null;
    this.isInitialized = false;
    this.whatsappService = null;
  }
  
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('Inicializando servicio de respuestas automáticas mejorado...');
    
    // Inicializar OpenAI
    const openaiKey = await getOpenAIApiKey();
    if (openaiKey) {
      try {
        this.openaiClient = new OpenAI({ apiKey: openaiKey });
        console.log('Cliente OpenAI inicializado correctamente');
      } catch (error) {
        console.error('Error al inicializar OpenAI:', error);
      }
    }
    
    // Inicializar Gemini
    try {
      this.geminiClient = new GeminiV1Client();
      console.log('Cliente Gemini inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar Gemini:', error);
    }
    
    this.isInitialized = true;
    console.log('Servicio de respuestas automáticas mejorado inicializado correctamente');
  }
  
  async processIncomingMessage(message) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Verificar si el servicio está habilitado
    if (!this.config.enabled) {
      console.log('Servicio de respuestas automáticas deshabilitado');
      return;
    }
    
    // Ignorar mensajes enviados por nosotros
    if (message.fromMe) {
      console.log('Ignorando mensaje propio');
      return;
    }
    
    // Verificar si el chat está excluido
    if (this.config.excludedChats.includes(message.from)) {
      console.log(`Chat ${message.from} excluido de respuestas automáticas`);
      return;
    }
    
    console.log(`Procesando mensaje entrante: ${message.body}`);
    
    // Obtener el nombre del contacto si está disponible
    let contactName = 'cliente';
    try {
      const contact = await message.getContact();
      contactName = contact.name || contact.pushname || 'cliente';
      console.log(`Nombre de contacto: ${contactName}`);
    } catch (err) {
      console.warn('No se pudo obtener nombre de contacto:', err);
    }
    
    // Generar respuesta con IA
    let responseText = await this.generateAIResponse(message.body, contactName);
    
    // Si hay una respuesta válida, enviarla
    if (responseText && responseText.trim()) {
      // Esperar un momento antes de responder para simular escritura
      setTimeout(async () => {
        try {
          // Simular estado de escritura
          const chat = await message.getChat();
          await chat.sendStateTyping();
          
          // Esperar un poco más antes de enviar el mensaje
          setTimeout(async () => {
            try {
              // Enviar la respuesta
              await message.reply(responseText);
              console.log('Respuesta automática enviada con éxito');
            } catch (sendError) {
              console.error('Error al enviar respuesta:', sendError);
            }
          }, 2000);
        } catch (typingError) {
          console.error('Error al enviar estado de escritura:', typingError);
          
          // Si falla el estado de escritura, intentar enviar directamente
          try {
            await message.reply(responseText);
            console.log('Respuesta automática enviada (sin estado de escritura)');
          } catch (finalError) {
            console.error('Error final al enviar respuesta:', finalError);
          }
        }
      }, this.config.delaySeconds * 1000);
    } else {
      console.warn('No se generó respuesta automática: respuesta vacía');
    }
  }
  
  async generateAIResponse(messageText, contactName) {
    // Primero intentar con el proveedor configurado
    if (this.config.aiProvider === "openai" && this.openaiClient) {
      try {
        return await this.generateWithOpenAI(messageText, contactName);
      } catch (error) {
        console.error('Error con OpenAI:', error);
        // Si falla, intentar con Gemini como respaldo
        if (this.geminiClient) {
          try {
            return await this.generateWithGemini(messageText, contactName);
          } catch (innerError) {
            console.error('Error con Gemini (respaldo):', innerError);
          }
        }
      }
    } else if (this.geminiClient) {
      try {
        return await this.generateWithGemini(messageText, contactName);
      } catch (error) {
        console.error('Error con Gemini:', error);
        // Si falla, intentar con OpenAI como respaldo
        if (this.openaiClient) {
          try {
            return await this.generateWithOpenAI(messageText, contactName);
          } catch (innerError) {
            console.error('Error con OpenAI (respaldo):', innerError);
          }
        }
      }
    }
    
    // Si todo falla, devolver mensaje por defecto
    return `Hola ${contactName}, gracias por tu mensaje. En breve nos pondremos en contacto contigo.`;
  }
  
  async generateWithOpenAI(messageText, contactName) {
    const systemPrompt = this.config.customPrompts.system
      .replace(/{{nombre}}/g, contactName);
    
    const response = await this.openaiClient.chat.completions.create({
      model: "gpt-4o", // el modelo más reciente de OpenAI es "gpt-4o"
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageText }
      ],
      temperature: this.config.customPrompts.temperature,
      max_tokens: this.config.customPrompts.maxTokens,
    });
    
    const result = response.choices[0].message.content || "";
    
    // Verificar que no esté vacío
    if (!result || result.trim() === "") {
      throw new Error("OpenAI devolvió una respuesta vacía");
    }
    
    return result;
  }
  
  async generateWithGemini(messageText, contactName) {
    const systemPrompt = this.config.customPrompts.system
      .replace(/{{nombre}}/g, contactName);
    
    // Formatear el prompt para Gemini
    const fullPrompt = `${systemPrompt}\n\nMensaje del cliente: ${messageText}\n\nTu respuesta:`;
    
    const result = await this.geminiClient.generateContent(
      fullPrompt,
      "gemini-pro",
      {
        temperature: this.config.customPrompts.temperature,
        maxOutputTokens: this.config.customPrompts.maxTokens,
        topP: 0.8,
        topK: 40
      }
    );
    
    // Verificar que no esté vacío
    if (!result || result.trim() === "") {
      throw new Error("Gemini devolvió una respuesta vacía");
    }
    
    return result;
  }
  
  setConfiguration(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    console.log('Configuración actualizada:', this.config);
  }
  
  getConfiguration() {
    return this.config;
  }
  
  disableForChat(chatId) {
    if (!this.config.excludedChats.includes(chatId)) {
      this.config.excludedChats.push(chatId);
      console.log(`Respuestas automáticas deshabilitadas para chat ${chatId}`);
    }
  }
  
  enableForChat(chatId) {
    const index = this.config.excludedChats.indexOf(chatId);
    if (index !== -1) {
      this.config.excludedChats.splice(index, 1);
      console.log(`Respuestas automáticas habilitadas para chat ${chatId}`);
    }
  }
}

// Crear y exportar la instancia del servicio
const autoResponseServiceFix = new AutoResponseServiceFix();

// Función para integrar el servicio con el de WhatsApp
async function integrateWithWhatsApp() {
  try {
    console.log('Integrando servicio de respuestas automáticas con WhatsApp...');
    
    // Importar servicio WhatsApp bajo demanda para evitar dependencias circulares
    const whatsappModule = require('./whatsappServiceImpl');
    const { whatsappService } = whatsappModule;
    
    if (!whatsappService) {
      throw new Error('Servicio de WhatsApp no disponible');
    }
    
    // Escuchar eventos de mensajes
    whatsappService.on('message', async (message) => {
      // Procesar el mensaje para respuesta automática
      try {
        await autoResponseServiceFix.processIncomingMessage(message);
      } catch (error) {
        console.error('Error procesando mensaje para respuesta automática:', error);
      }
    });
    
    console.log('Integración con WhatsApp completada. Respuestas automáticas activadas.');
    return true;
  } catch (error) {
    console.error('Error al integrar con WhatsApp:', error);
    
    // Intentar nuevamente después de un retraso (para dar tiempo a que el servicio de WhatsApp se inicialice)
    setTimeout(() => {
      integrateWithWhatsApp()
        .then(success => console.log('Reintento de integración con WhatsApp:', success ? 'exitoso' : 'fallido'))
        .catch(err => console.error('Error en reintento de integración:', err));
    }, 10000);
    
    return false;
  }
}

// Inicializar el servicio
autoResponseServiceFix.initialize()
  .then(() => {
    console.log('Servicio de respuestas automáticas inicializado correctamente');
    
    // Intentar integrar con WhatsApp después de una breve pausa
    setTimeout(() => {
      integrateWithWhatsApp()
        .then(result => console.log('Resultado de integración con WhatsApp:', result ? 'exitoso' : 'fallido'))
        .catch(err => console.error('Error en integración inicial:', err));
    }, 5000);
  })
  .catch(error => {
    console.error('Error inicializando servicio de respuestas automáticas:', error);
  });

module.exports = {
  autoResponseServiceFix,
  integrateWithWhatsApp
};