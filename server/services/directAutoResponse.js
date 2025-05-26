/**
 * Servicio de respuestas automáticas directo para WhatsApp
 * Este es un servicio simplificado que funciona directamente con los eventos del cliente de WhatsApp
 */

const OpenAI = require('openai');
const { GeminiV1Client } = require('./geminiV1');
const { getGeminiApiKey, getOpenAIApiKey } = require('./aiKeysManager');

// Configuración para respuestas automáticas
const config = {
  enabled: true,            // Habilitar/deshabilitar respuestas automáticas
  delay: 3000,              // Retraso antes de responder (ms)
  useAI: true,              // Usar IA para generar respuestas
  defaultMessage: "Gracias por tu mensaje. Pronto nos pondremos en contacto contigo.",
  excludedChats: []         // Chats excluidos (no enviar respuestas automáticas)
};

// Instancias de clientes de IA
let openaiClient = null;
let geminiClient = null;

/**
 * Inicializa los clientes de IA
 */
async function initializeAIClients() {
  try {
    // Inicializar OpenAI
    const openaiKey = await getOpenAIApiKey();
    if (openaiKey) {
      openaiClient = new OpenAI({ apiKey: openaiKey });
      console.log('[AutoResp] Cliente OpenAI inicializado correctamente');
    } else {
      console.log('[AutoResp] No se pudo inicializar OpenAI: falta API key');
    }

    // Inicializar Gemini
    try {
      geminiClient = new GeminiV1Client();
      console.log('[AutoResp] Cliente Gemini inicializado correctamente');
    } catch (error) {
      console.error('[AutoResp] Error al inicializar Gemini:', error);
    }

    return true;
  } catch (error) {
    console.error('[AutoResp] Error al inicializar clientes de IA:', error);
    return false;
  }
}

/**
 * Procesa un mensaje entrante y genera una respuesta automática
 */
async function handleMessage(message, whatsappClient) {
  // Verificar si el servicio está habilitado
  if (!config.enabled) {
    console.log('[AutoResp] Servicio deshabilitado');
    return;
  }

  // Ignorar mensajes propios
  if (message.fromMe) {
    console.log('[AutoResp] Mensaje propio, ignorando');
    return;
  }

  // Verificar si el chat está excluido
  if (config.excludedChats.includes(message.from)) {
    console.log(`[AutoResp] Chat ${message.from} excluido`);
    return;
  }

  // Inicializar clientes si es necesario
  if (!openaiClient && !geminiClient) {
    await initializeAIClients();
  }

  // Obtener nombre del contacto
  let contactName = 'cliente';
  try {
    const contact = await message.getContact();
    contactName = contact.pushname || contact.name || 'cliente';
    console.log(`[AutoResp] Nombre de contacto: ${contactName}`);
  } catch (error) {
    console.log('[AutoResp] Error obteniendo contacto:', error);
  }

  // Generar respuesta
  let responseText = '';
  if (config.useAI) {
    try {
      responseText = await generateResponse(message.body, contactName);
      console.log(`[AutoResp] Respuesta generada por IA: ${responseText.substring(0, 50)}...`);
    } catch (error) {
      console.error('[AutoResp] Error generando respuesta con IA:', error);
      responseText = config.defaultMessage.replace('{{nombre}}', contactName);
    }
  } else {
    responseText = config.defaultMessage.replace('{{nombre}}', contactName);
  }

  // Enviar respuesta con retraso
  setTimeout(async () => {
    try {
      // Simular "escribiendo..."
      const chat = await message.getChat();
      await chat.sendStateTyping();
      
      // Esperar un poco más para simular escritura
      setTimeout(async () => {
        try {
          // Enviar respuesta
          await message.reply(responseText);
          console.log('[AutoResp] Respuesta automática enviada');
        } catch (innerError) {
          console.error('[AutoResp] Error enviando respuesta:', innerError);
        }
      }, 2000);
    } catch (error) {
      console.error('[AutoResp] Error enviando estado de escritura:', error);
      
      // Intentar enviar sin estado de escritura
      try {
        await message.reply(responseText);
        console.log('[AutoResp] Respuesta enviada (sin estado de escritura)');
      } catch (finalError) {
        console.error('[AutoResp] Error final enviando respuesta:', finalError);
      }
    }
  }, config.delay);
}

/**
 * Genera una respuesta utilizando IA
 */
async function generateResponse(messageText, contactName) {
  // Intentar primero con Gemini (más económico)
  if (geminiClient) {
    try {
      const systemPrompt = `
Eres un asistente profesional que representa a una empresa. 
Responde de manera cordial, clara y concisa.
IMPORTANTE: NO uses mensajes genéricos como "Hola, gracias por tu mensaje" o "En breve nos pondremos en contacto contigo".
Personaliza completamente tu respuesta al contexto del mensaje.
Usa el nombre ${contactName} de forma natural en tu respuesta, no como saludo genérico.
Mantén tus respuestas útiles y breves (máximo 3 oraciones).
Si no conoces la respuesta exacta, indícale que un asesor se pondrá en contacto pronto, pero de manera personalizada.
Analiza qué productos o servicios parecen interesar al cliente según su mensaje.
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
      throw new Error("Respuesta vacía");
    } catch (error) {
      console.error('[AutoResp] Error con Gemini:', error);
      // Intentar con OpenAI como respaldo
    }
  }
  
  // Si Gemini falló o no está disponible, intentar con OpenAI
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
      
      const generatedText = response.choices[0].message.content;
      if (generatedText && generatedText.trim() !== "") {
        return generatedText;
      }
      throw new Error("Respuesta vacía de OpenAI");
    } catch (error) {
      console.error('[AutoResp] Error con OpenAI:', error);
    }
  }
  
  // DESHABILITADO: No usar respuestas de fallback, solo usar agente externo
  console.log(`⚠️ DirectAutoResponse: No se genera respuesta fallback para ${contactName}. Solo usar agente externo.`);
  return null;
}

module.exports = {
  handleMessage,
  initializeAIClients,
  config
};