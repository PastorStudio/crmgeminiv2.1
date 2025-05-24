/**
 * SmartBots AI Service
 * Integración con SmartBots para generar respuestas automáticas inteligentes
 */

export interface SmartBotsResponse {
  success: boolean;
  response: string;
  originalMessage: string;
  confidence: number;
  model?: string;
}

/**
 * Genera una respuesta automática usando SmartBots
 */
export async function generateSmartBotsResponse(
  userMessage: string,
  contactName: string = 'Usuario',
  context?: string
): Promise<SmartBotsResponse> {
  try {
    console.log('🤖 Enviando mensaje a SmartBots:', userMessage);
    
    // Preparar el prompt con contexto
    const prompt = context 
      ? `Contexto: ${context}\n\nMensaje de ${contactName}: ${userMessage}\n\nResponde de manera profesional y útil:`
      : `Mensaje de ${contactName}: ${userMessage}\n\nResponde de manera profesional y útil:`;

    // URL de SmartBots API
    const smartBotsUrl = 'https://api.smartbots.ai/v1/chat/completions';
    
    const response = await fetch(smartBotsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SMARTBOTS_API_KEY || 'demo-key'}`,
        'User-Agent': 'WhatsApp-CRM/1.0'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente virtual profesional para WhatsApp. Responde de manera amigable, concisa y útil. Mantén un tono profesional pero cercano.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || '';
      
      if (aiResponse) {
        console.log('✅ Respuesta de SmartBots:', aiResponse);
        
        return {
          success: true,
          response: aiResponse.trim(),
          originalMessage: userMessage,
          confidence: 0.9,
          model: 'SmartBots GPT'
        };
      }
    }

    // Si SmartBots no funciona, usar respuestas inteligentes de respaldo
    console.log('⚠️ SmartBots no disponible, usando respuestas inteligentes');
    return generateFallbackResponse(userMessage, contactName);

  } catch (error) {
    console.error('❌ Error con SmartBots:', error);
    return generateFallbackResponse(userMessage, contactName);
  }
}

/**
 * Genera respuestas inteligentes de respaldo basadas en patrones
 */
function generateFallbackResponse(userMessage: string, contactName: string): SmartBotsResponse {
  const message = userMessage.toLowerCase();
  
  // Saludos
  if (/hola|hello|hi|buenos días|buenas tardes|buenas noches|hey/i.test(message)) {
    const responses = [
      `¡Hola ${contactName}! 👋 ¿En qué puedo ayudarte hoy?`,
      `¡Bienvenido ${contactName}! ¿Cómo puedo asistirte?`,
      `Hola ${contactName}, es un gusto saludarte. ¿En qué te puedo ayudar?`
    ];
    return {
      success: true,
      response: responses[Math.floor(Math.random() * responses.length)],
      originalMessage: userMessage,
      confidence: 0.85
    };
  }

  // Preguntas sobre productos/servicios
  if (/precio|cost|cuanto|precio|información|info|servicio|product/i.test(message)) {
    const responses = [
      `Gracias por tu interés ${contactName}. Te enviaré información detallada sobre nuestros productos y precios. 💼`,
      `Perfecto ${contactName}, permíteme enviarte nuestra lista de precios actualizada. 📋`,
      `Excelente pregunta ${contactName}. Te compartiré toda la información sobre nuestros servicios. ✨`
    ];
    return {
      success: true,
      response: responses[Math.floor(Math.random() * responses.length)],
      originalMessage: userMessage,
      confidence: 0.8
    };
  }

  // Agradecimientos
  if (/gracias|thank you|thanks|muchas gracias/i.test(message)) {
    const responses = [
      `¡De nada ${contactName}! Estoy aquí para ayudarte siempre que lo necesites. 😊`,
      `¡Un placer ayudarte ${contactName}! Si tienes más preguntas, no dudes en escribir. 👍`,
      `¡Gracias a ti ${contactName}! Que tengas un excelente día. ⭐`
    ];
    return {
      success: true,
      response: responses[Math.floor(Math.random() * responses.length)],
      originalMessage: userMessage,
      confidence: 0.9
    };
  }

  // Despedidas
  if (/adiós|bye|hasta luego|nos vemos|chao|goodbye/i.test(message)) {
    const responses = [
      `¡Hasta luego ${contactName}! Que tengas un día fantástico. 👋`,
      `¡Nos vemos pronto ${contactName}! Cuídate mucho. 😊`,
      `¡Adiós ${contactName}! Estaré aquí cuando me necesites. ✨`
    ];
    return {
      success: true,
      response: responses[Math.floor(Math.random() * responses.length)],
      originalMessage: userMessage,
      confidence: 0.85
    };
  }

  // Respuesta general inteligente
  const generalResponses = [
    `Entiendo ${contactName}. Permíteme revisar tu consulta y te daré una respuesta detallada. 🔍`,
    `Gracias por escribir ${contactName}. Estoy procesando tu mensaje para darte la mejor respuesta. ⚡`,
    `Hola ${contactName}, he recibido tu mensaje. Te responderé en breve con toda la información. 📩`,
    `${contactName}, agradezco tu mensaje. Un momento mientras busco la información que necesitas. 🔎`
  ];

  return {
    success: true,
    response: generalResponses[Math.floor(Math.random() * generalResponses.length)],
    originalMessage: userMessage,
    confidence: 0.7
  };
}