/**
 * Utilidad para generar respuestas automáticas usando OpenAI directamente
 * Evita las interferencias de Vite con las llamadas al servidor
 */

export async function generateDirectAutoResponse(messageText: string): Promise<string | null> {
  try {
    console.log('🤖 Generando respuesta automática con SmartBots...');
    
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.error('❌ No se encontró la clave API de OpenAI');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Eres SmartBots, un asistente inteligente especializado en brindar respuestas útiles y profesionales. Responde de manera concisa, amigable y directa en español. Mantén un tono conversacional y cercano."
          },
          {
            role: "user",
            content: messageText
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.error('❌ Error en respuesta de OpenAI:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const autoResponse = data.choices[0]?.message?.content;
    
    if (autoResponse) {
      console.log('✅ Respuesta de SmartBots generada:', autoResponse);
      return autoResponse.trim();
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error generando respuesta automática:', error);
    return null;
  }
}

/**
 * Extrae el último mensaje recibido (no enviado por nosotros)
 */
export function getLastReceivedMessage(messages: any[]): string | null {
  if (!messages || !Array.isArray(messages)) {
    return null;
  }

  // Buscar el último mensaje que no es nuestro (fromMe = false)
  const lastReceived = messages
    .filter((msg: any) => !msg.fromMe && msg.body && msg.body.trim().length > 0)
    .sort((a: any, b: any) => b.timestamp - a.timestamp)[0];

  return lastReceived?.body || null;
}