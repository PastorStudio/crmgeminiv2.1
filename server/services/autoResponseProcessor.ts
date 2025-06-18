/**
 * Procesador de respuestas automáticas A.E AI
 * Detecta mensajes nuevos y genera respuestas usando agentes externos
 */

import OpenAI from 'openai';

// Usar la API key del entorno
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY 
});

// Sistema de configuración A.E AI por chat
const chatConfigurations: Map<string, {
  active: boolean;
  agentUrl: string;
  agentName: string;
  lastProcessedMessageId?: string;
}> = new Map();

/**
 * Activa/desactiva A.E AI para un chat específico
 */
export function configureAEAI(chatId: string, active: boolean, agentUrl: string = '', agentName: string = 'Smartbots') {
  const config = {
    active,
    agentUrl: agentUrl || 'https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots',
    agentName
  };
  
  chatConfigurations.set(chatId, config);
  
  console.log(`🤖 A.E AI ${active ? 'ACTIVADO' : 'DESACTIVADO'} para chat ${chatId}`);
  console.log(`📋 Configuración:`, config);
  
  return config;
}

/**
 * Verifica si A.E AI está activo para un chat
 */
export function isAEAIActive(chatId: string): boolean {
  const config = chatConfigurations.get(chatId);
  return config?.active || false;
}

/**
 * Obtiene la configuración A.E AI de un chat
 */
export function getAEAIConfig(chatId: string) {
  return chatConfigurations.get(chatId) || { active: false, agentUrl: '', agentName: '' };
}

/**
 * Genera respuesta usando OpenAI con contexto del agente externo
 */
async function generateAgentResponse(message: string, agentName: string = 'Smartbots'): Promise<string> {
  try {
    console.log(`🧠 Generando respuesta con ${agentName} para: "${message}"`);
    
    const systemPrompt = `Eres un asistente conversacional natural y empático.
    
    INSTRUCCIONES IMPORTANTES:
    - Responde de forma casual y humana, como una conversación real
    - NO uses saludos formales repetitivos ni frases institucionales  
    - NO menciones departamentos, agentes específicos o estructuras organizacionales
    - Sé directo, amigable y útil
    - Varía tus respuestas para evitar repetición
    - Usa un tono conversacional como si fueras una persona real ayudando
    - Haz preguntas de seguimiento relevantes cuando sea apropiado
    - Mantén las respuestas cortas y al punto (máximo 2-3 líneas)
    
    Ejemplos de BUENOS inicios:
    - "¡Hola! ¿En qué te puedo ayudar?"
    - "¿Qué tal? ¿Cómo puedo asistirte?"
    - "¡Hey! Cuéntame, ¿qué necesitas?"
    - "¿En qué te puedo echar una mano?"
    
    Responde de forma natural y conversacional.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // el modelo más reciente de OpenAI
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    const generatedResponse = response.choices[0].message.content || "Lo siento, no pude procesar tu mensaje en este momento.";
    
    console.log(`✅ Respuesta generada por ${agentName}:`, generatedResponse);
    return generatedResponse;
    
  } catch (error) {
    console.error(`❌ Error generando respuesta con ${agentName}:`, error);
    return "Disculpa, estoy experimentando dificultades técnicas. ¿Puedes intentar nuevamente en un momento?";
  }
}

/**
 * Procesa un mensaje entrante y genera respuesta automática si A.E AI está activo
 */
export async function processIncomingMessage(
  chatId: string, 
  messageId: string,
  messageText: string,
  isFromUser: boolean,
  whatsappInstance?: any
): Promise<boolean> {
  
  // Solo procesar mensajes de usuarios (no mensajes salientes)
  if (!isFromUser) {
    return false;
  }
  
  const config = chatConfigurations.get(chatId);
  
  // Verificar si A.E AI está activo para este chat
  if (!config?.active) {
    return false;
  }
  
  // Evitar procesar el mismo mensaje múltiples veces
  if (config.lastProcessedMessageId === messageId) {
    return false;
  }
  
  console.log(`🔄 PROCESANDO MENSAJE A.E AI:`);
  console.log(`📱 Chat: ${chatId}`);
  console.log(`📧 Mensaje: "${messageText}"`);
  console.log(`🤖 Agente: ${config.agentName}`);
  
  try {
    // Generar respuesta automática
    const autoResponse = await generateAgentResponse(messageText, config.agentName);
    
    // Enviar respuesta automática via WhatsApp
    if (whatsappInstance && whatsappInstance.sendMessage) {
      console.log(`📤 Enviando respuesta automática a ${chatId}: "${autoResponse}"`);
      
      await whatsappInstance.sendMessage(chatId, autoResponse);
      
      // Marcar mensaje como procesado
      config.lastProcessedMessageId = messageId;
      chatConfigurations.set(chatId, config);
      
      console.log(`✅ Respuesta automática enviada exitosamente`);
      return true;
      
    } else {
      console.log(`📝 Respuesta generada (WhatsApp no disponible): "${autoResponse}"`);
      return true;
    }
    
  } catch (error) {
    console.error(`❌ Error procesando mensaje A.E AI:`, error);
    return false;
  }
}

/**
 * Obtiene estadísticas de A.E AI
 */
export function getAEAIStats() {
  const totalChats = chatConfigurations.size;
  const activeChats = Array.from(chatConfigurations.values()).filter(config => config.active).length;
  
  return {
    totalChats,
    activeChats,
    configurations: Array.from(chatConfigurations.entries()).map(([chatId, config]) => ({
      chatId,
      ...config
    }))
  };
}

export default {
  configureAEAI,
  isAEAIActive,
  getAEAIConfig,
  processIncomingMessage,
  getAEAIStats
};