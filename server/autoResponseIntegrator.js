/**
 * Integrador de respuestas automáticas para WhatsApp
 * Este script monitorea el servicio de WhatsApp e implementa respuestas automáticas
 * utilizando las funciones mejoradas.
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Cargar dependencias dinámicamente para evitar problemas circulares
let openaiClient = null;
let geminiClient = null;

// Configuración
const config = {
  enabled: true,  // ACTIVADO para permitir respuestas automáticas
  delay: 2000,
  excludedChats: []
};

// Inicializar servicios de IA
async function initializeAI() {
  try {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('[AutoResponseIntegrator] OpenAI inicializado');
    }
    
    // Gemini
    try {
      const { GeminiV1Client } = require('./services/geminiV1');
      geminiClient = new GeminiV1Client();
      console.log('[AutoResponseIntegrator] Gemini inicializado');
    } catch (error) {
      console.error('[AutoResponseIntegrator] Error inicializando Gemini:', error);
    }
    
    return true;
  } catch (error) {
    console.error('[AutoResponseIntegrator] Error inicializando IA:', error);
    return false;
  }
}

// Generar respuesta con IA
async function generateResponse(messageText, contactName) {
  // Intentar con Gemini primero (más económico)
  if (geminiClient) {
    try {
      const systemPrompt = `
Eres un asistente profesional que representa a una empresa. 
Responde de manera cordial, clara y concisa.
Incluye siempre un saludo personalizado usando el nombre ${contactName}.
Mantén tus respuestas útiles y breves (máximo 3 oraciones).
`;
      const prompt = `${systemPrompt}\n\nMensaje del cliente: ${messageText}\n\nTu respuesta:`;
      
      const response = await geminiClient.generateContent(
        prompt,
        "gemini-pro",
        {
          temperature: 0.7,
          maxOutputTokens: 200,
          topP: 0.9,
          topK: 40
        }
      );
      
      if (response && response.trim() !== "") {
        return response;
      }
    } catch (error) {
      console.error('[AutoResponseIntegrator] Error con Gemini:', error);
    }
  }
  
  // Si Gemini falló, intentar con OpenAI
  if (openaiClient) {
    try {
      const systemPrompt = `Eres un asistente profesional que representa a una empresa. Responde de manera cordial, clara y concisa. Incluye siempre un saludo personalizado usando el nombre ${contactName}.`;
      
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageText }
        ],
        temperature: 0.7,
        max_tokens: 150
      });
      
      const text = response.choices[0].message.content;
      if (text && text.trim() !== "") {
        return text;
      }
    } catch (error) {
      console.error('[AutoResponseIntegrator] Error con OpenAI:', error);
    }
  }
  
  // Respuesta por defecto si todo falla
  return `Hola ${contactName}, gracias por tu mensaje. Pronto nos pondremos en contacto contigo.`;
}

// Función principal para manejar mensajes
async function handleMessage(message) {
  if (!config.enabled || message.fromMe || config.excludedChats.includes(message.from)) {
    return;
  }
  
  try {
    // Inicializar IA si es necesario
    if (!openaiClient && !geminiClient) {
      await initializeAI();
    }
    
    // Obtener nombre del contacto
    let contactName = 'cliente';
    try {
      const contact = await message.getContact();
      contactName = contact.pushname || contact.name || 'cliente';
    } catch (error) {
      console.log('[AutoResponseIntegrator] Error obteniendo contacto');
    }
    
    // Generar respuesta
    const responseText = await generateResponse(message.body, contactName);
    
    // Enviar respuesta con delay
    setTimeout(async () => {
      try {
        // Intentar simular "escribiendo..."
        try {
          const chat = await message.getChat();
          await chat.sendStateTyping();
        } catch (error) {
          console.log('[AutoResponseIntegrator] Error enviando estado typing');
        }
        
        // Esperar un poco más antes de enviar
        setTimeout(async () => {
          try {
            await message.reply(responseText);
            console.log('[AutoResponseIntegrator] Respuesta enviada:', responseText);
          } catch (error) {
            console.error('[AutoResponseIntegrator] Error enviando respuesta:', error);
          }
        }, 2000);
      } catch (error) {
        console.error('[AutoResponseIntegrator] Error general:', error);
      }
    }, config.delay);
  } catch (error) {
    console.error('[AutoResponseIntegrator] Error manejando mensaje:', error);
  }
}

// Conectar al servicio de WhatsApp
function connect() {
  try {
    console.log('[AutoResponseIntegrator] Intentando conectar al servicio WhatsApp');
    
    // Importar dinámicamente para evitar dependencias circulares
    const { whatsappService } = require('./services/whatsappServiceImpl');
    
    // Escuchar eventos de mensajes
    whatsappService.on('message', handleMessage);
    
    console.log('[AutoResponseIntegrator] Integración completada: respuestas automáticas activadas');
    
    return true;
  } catch (error) {
    console.error('[AutoResponseIntegrator] Error conectando al servicio WhatsApp:', error);
    return false;
  }
}

// Exportar funciones
module.exports = {
  connect,
  handleMessage,
  config
};

// Auto-conectar al inicializar
console.log('[AutoResponseIntegrator] Iniciando servicio de respuestas automáticas...');
setTimeout(connect, 5000);  // Esperar 5 segundos para asegurar que WhatsApp esté listo