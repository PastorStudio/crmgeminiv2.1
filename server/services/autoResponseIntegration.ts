/**
 * Integración TypeScript para el servicio de respuestas automáticas
 * Este archivo proporciona funcionalidad para conectar el servicio mejorado
 * de respuestas automáticas con el servicio de WhatsApp existente.
 */

import { whatsappService } from './whatsappServiceImpl';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';

// Importaciones de servicios para gestión de claves API
import { getOpenAIApiKey, getGeminiApiKey } from './aiKeysManager';

// Configuración para respuestas automáticas
const config = {
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

// Variables para clientes de IA
let openaiClient: OpenAI | null = null;
let geminiClient: any = null;
let isInitialized = false;

/**
 * Inicializa los clientes de IA necesarios para respuestas automáticas
 */
export async function initialize() {
  if (isInitialized) return;
  
  console.log('Inicializando servicio de respuestas automáticas mejorado...');
  
  // Inicializar OpenAI
  try {
    const openaiKey = await getOpenAIApiKey();
    if (openaiKey) {
      openaiClient = new OpenAI({ apiKey: openaiKey });
      console.log('Cliente OpenAI inicializado correctamente para respuestas automáticas');
    } else {
      console.log('No se pudo inicializar OpenAI: falta API key');
    }
  } catch (error) {
    console.error('Error inicializando OpenAI:', error);
  }
  
  // Inicializar Gemini
  try {
    // Importar dinámicamente para evitar problemas circulares
    const { GeminiV1Client } = await import('./geminiV1');
    geminiClient = new GeminiV1Client();
    console.log('Cliente Gemini inicializado correctamente para respuestas automáticas');
  } catch (error) {
    console.error('Error inicializando Gemini:', error);
  }
  
  isInitialized = true;
}

/**
 * Maneja un mensaje de WhatsApp entrante para generar una posible respuesta automática
 */
export async function handleIncomingMessage(message: any) {
  // Verificar si el servicio está habilitado
  if (!config.enabled) {
    return;
  }
  
  // Ignorar mensajes enviados por nosotros
  if (message.fromMe) {
    return;
  }
  
  // Verificar si el chat está excluido
  if (config.excludedChats.includes(message.from)) {
    return;
  }
  
  // Asegurarse de que los clientes estén inicializados
  if (!isInitialized) {
    await initialize();
  }
  
  // Obtener nombre del contacto
  let contactName = 'cliente';
  try {
    const contact = await message.getContact();
    contactName = contact.name || contact.pushname || 'cliente';
    console.log(`Nombre del contacto para respuesta automática: ${contactName}`);
  } catch (err) {
    console.warn('No se pudo obtener el nombre del contacto para respuesta automática');
  }
  
  // Generar respuesta con IA
  let responseText = await generateAIResponse(message.body, contactName);
  
  // Si hay una respuesta, enviarla con retraso para simular escritura
  if (responseText && responseText.trim()) {
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
            console.error('Error al enviar respuesta automática:', sendError);
          }
        }, 2000);
      } catch (typingError) {
        console.error('Error al enviar estado de escritura:', typingError);
        
        // Si falla el estado de escritura, intentar enviar directamente
        try {
          await message.reply(responseText);
          console.log('Respuesta automática enviada (sin estado de escritura)');
        } catch (finalError) {
          console.error('Error final al enviar respuesta automática:', finalError);
        }
      }
    }, config.delaySeconds * 1000);
  }
}

/**
 * Genera una respuesta utilizando IA
 */
async function generateAIResponse(messageText: string, contactName: string): Promise<string> {
  // Primero intentar con el proveedor configurado
  if (config.aiProvider === "openai" && openaiClient) {
    try {
      return await generateWithOpenAI(messageText, contactName);
    } catch (error) {
      console.error('Error con OpenAI:', error);
      // Si falla, intentar con Gemini como respaldo
      if (geminiClient) {
        try {
          return await generateWithGemini(messageText, contactName);
        } catch (innerError) {
          console.error('Error con Gemini (respaldo):', innerError);
        }
      }
    }
  } else if (geminiClient) {
    try {
      return await generateWithGemini(messageText, contactName);
    } catch (error) {
      console.error('Error con Gemini:', error);
      // Si falla, intentar con OpenAI como respaldo
      if (openaiClient) {
        try {
          return await generateWithOpenAI(messageText, contactName);
        } catch (innerError) {
          console.error('Error con OpenAI (respaldo):', innerError);
        }
      }
    }
  }
  
  // Si todo falla, devolver mensaje por defecto
  return `Hola ${contactName}, gracias por tu mensaje. En breve nos pondremos en contacto contigo.`;
}

/**
 * Genera respuesta usando OpenAI
 */
async function generateWithOpenAI(messageText: string, contactName: string): Promise<string> {
  if (!openaiClient) throw new Error("Cliente OpenAI no inicializado");
  
  const systemPrompt = config.customPrompts.system
    .replace(/{{nombre}}/g, contactName);
  
  const response = await openaiClient.chat.completions.create({
    model: "gpt-4o", // el modelo más reciente de OpenAI es "gpt-4o" 
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: messageText }
    ],
    temperature: config.customPrompts.temperature,
    max_tokens: config.customPrompts.maxTokens,
  });
  
  const result = response.choices[0].message.content || "";
  
  // Verificar que no esté vacío
  if (!result || result.trim() === "") {
    throw new Error("OpenAI devolvió una respuesta vacía");
  }
  
  return result;
}

/**
 * Genera respuesta usando Gemini
 */
async function generateWithGemini(messageText: string, contactName: string): Promise<string> {
  if (!geminiClient) throw new Error("Cliente Gemini no inicializado");
  
  const systemPrompt = config.customPrompts.system
    .replace(/{{nombre}}/g, contactName);
  
  // Formatear el prompt para Gemini
  const fullPrompt = `${systemPrompt}\n\nMensaje del cliente: ${messageText}\n\nTu respuesta:`;
  
  const result = await geminiClient.generateContent(
    fullPrompt,
    "gemini-pro",
    {
      temperature: config.customPrompts.temperature,
      maxOutputTokens: config.customPrompts.maxTokens,
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

/**
 * Integra el servicio de respuestas automáticas con el servicio de WhatsApp
 */
export async function setupAutoResponsesWithWhatsApp() {
  try {
    // Inicializar los clientes de IA
    await initialize();
    
    // Verificar que el servicio de WhatsApp esté disponible
    if (!whatsappService) {
      throw new Error('Servicio de WhatsApp no disponible');
    }
    
    // Escuchar eventos de mensajes
    whatsappService.on('message', async (message: any) => {
      try {
        await handleIncomingMessage(message);
      } catch (error) {
        console.error('Error procesando mensaje para respuesta automática:', error);
      }
    });
    
    console.log('Servicio de respuestas automáticas integrado correctamente con WhatsApp');
    return true;
  } catch (error) {
    console.error('Error al integrar servicio de respuestas automáticas con WhatsApp:', error);
    return false;
  }
}

/**
 * Configura las respuestas automáticas
 */
export function setAutoResponseConfig(newConfig: any) {
  config.enabled = newConfig.enabled ?? config.enabled;
  config.aiProvider = newConfig.aiProvider ?? config.aiProvider;
  config.delaySeconds = newConfig.delaySeconds ?? config.delaySeconds;
  
  if (newConfig.customPrompts) {
    config.customPrompts = {
      ...config.customPrompts,
      ...newConfig.customPrompts
    };
  }
  
  if (newConfig.excludedChats) {
    config.excludedChats = [...newConfig.excludedChats];
  }
  
  console.log('Configuración de respuestas automáticas actualizada:', config);
}

/**
 * Obtiene la configuración actual
 */
export function getAutoResponseConfig() {
  return { ...config };
}