/**
 * Script de arreglo para respuestas automáticas
 * Este archivo contiene las funciones mejoradas para generar respuestas automáticas
 * usando tanto Gemini como OpenAI.
 */

const OpenAI = require('openai');
const { GeminiV1Client } = require('./geminiV1');
const { getGeminiApiKey, getOpenAIApiKey } = require('./aiKeysManager');

// Función principal para generar respuesta usando IA
async function generateAIResponse(messageText, contactName) {
  try {
    console.log(`Generando respuesta para mensaje: "${messageText.substring(0, 50)}..." de ${contactName}`);
    
    // Intentar primero con Gemini (más económico)
    try {
      const geminiResponse = await generateWithGemini(messageText, contactName);
      if (geminiResponse && geminiResponse.trim() !== "") {
        console.log("Respuesta generada exitosamente con Gemini");
        return geminiResponse;
      }
    } catch (geminiError) {
      console.error("Error generando respuesta con Gemini:", geminiError);
    }
    
    // Si Gemini falla, intentar con OpenAI
    try {
      const openaiResponse = await generateWithOpenAI(messageText, contactName);
      if (openaiResponse && openaiResponse.trim() !== "") {
        console.log("Respuesta generada exitosamente con OpenAI");
        return openaiResponse;
      }
    } catch (openaiError) {
      console.error("Error generando respuesta con OpenAI:", openaiError);
    }
    
    // Si ambos fallan, devolver mensaje por defecto
    return `Hola ${contactName}, gracias por tu mensaje. En breve nos comunicaremos contigo.`;
  } catch (error) {
    console.error("Error general generando respuesta:", error);
    return `Hola ${contactName}, gracias por tu mensaje. Nuestro equipo se pondrá en contacto contigo a la brevedad.`;
  }
}

// Función para generar respuesta con Gemini
async function generateWithGemini(messageText, contactName) {
  const client = new GeminiV1Client();
  
  // Verificar que el cliente se inicializó correctamente
  if (!client) {
    throw new Error("No se pudo inicializar el cliente de Gemini");
  }
  
  // Crear el prompt con formato específico para Gemini
  const systemPrompt = `Eres un asistente profesional que representa a una empresa. 
Responde de manera cordial, clara y concisa. 
Incluye siempre un saludo con el nombre ${contactName} al principio.
Mantén tus respuestas concretas y útiles.
Nunca inventes información.`;

  const fullPrompt = `${systemPrompt}

Mensaje del cliente: ${messageText}

Tu respuesta:`;

  // Generar respuesta con parámetros específicos para evitar problemas
  const response = await client.generateContent(
    fullPrompt,
    "gemini-pro",
    {
      temperature: 0.7,
      maxOutputTokens: 200,
      topP: 0.9,
      topK: 40
    }
  );
  
  // Validar la respuesta
  if (!response || response.trim() === "") {
    throw new Error("Gemini generó una respuesta vacía");
  }
  
  return response;
}

// Función para generar respuesta con OpenAI
async function generateWithOpenAI(messageText, contactName) {
  // Obtener API key
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("No se encontró API key para OpenAI");
  }
  
  // Inicializar cliente
  const client = new OpenAI({ apiKey });
  
  // Crear el prompt para OpenAI
  const systemPrompt = `Eres un asistente profesional que representa a una empresa. 
Responde de manera cordial, clara y concisa. 
Incluye siempre un saludo con el nombre ${contactName} al principio.
Mantén tus respuestas concretas y útiles.
Nunca inventes información.`;

  // Hacer la solicitud a OpenAI
  const completion = await client.chat.completions.create({
    model: "gpt-4o", // modelo más reciente
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: messageText }
    ],
    temperature: 0.7,
    max_tokens: 200
  });
  
  // Extraer y validar la respuesta
  const response = completion.choices[0].message.content;
  if (!response || response.trim() === "") {
    throw new Error("OpenAI generó una respuesta vacía");
  }
  
  return response;
}

// Exportar funciones
module.exports = {
  generateAIResponse,
  generateWithGemini,
  generateWithOpenAI
};