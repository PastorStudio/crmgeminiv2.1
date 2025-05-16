import { GoogleGenerativeAI } from '@google/generative-ai';

// Usar la clave API de las variables de entorno disponibles en el cliente
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || (window as any).VITE_GEMINI_API_KEY || '';

// Verificar si tenemos la clave API
if (!API_KEY) {
  console.warn('No se encontró una clave API para Gemini. Las respuestas automáticas no funcionarán.');
}

console.log('Estado de la clave API de Gemini:', API_KEY ? 'Configurada' : 'No configurada');

// Inicializar cliente de Gemini
const genAI = new GoogleGenerativeAI(API_KEY);

// Configuración para el modelo de generación de texto
const textModelConfig = {
  temperature: 0.7,
  topP: 0.8,
  topK: 40,
};

/**
 * Genera una respuesta automática basada en el mensaje del usuario y el historial de chat
 * @param message El mensaje del usuario
 * @param chatHistory Historial de conversación (opcional)
 * @param customPrompt Prompt personalizado para la respuesta (opcional)
 * @returns La respuesta generada por Gemini
 */
export async function generateAutoResponse(
  message: string, 
  chatHistory: string[] = [], 
  customPrompt?: string
): Promise<string> {
  try {
    // Verificar si hay una API key configurada
    if (!API_KEY) {
      return "No se pudo generar respuesta automática. API Key de Gemini no configurada.";
    }

    // Acceder al modelo de generación de texto
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro"
    });

    // Usar el prompt personalizado si está disponible, o el predeterminado
    let systemPrompt = customPrompt || `
    Estás actuando como un asistente de atención al cliente profesional y útil. 
    Responde al siguiente mensaje del cliente. Tu respuesta debe ser:
    - Concisa y directa
    - Profesional y atenta
    - Útil y orientada a resolver la consulta del cliente
    - En español y con un tono amigable pero profesional
    
    IMPORTANTE: Mantén la continuidad de la conversación. Si te preguntan por algo mencionado anteriormente,
    haz referencia a ello en tu respuesta. Si te preguntan por detalles de un producto o servicio mencionado
    en mensajes anteriores, incluye esa información en tu respuesta.
    `;

    // Crear mensaje de usuario
    const userMessage = message;

    // Crear el historial de chat para Gemini en formato de chat real
    const chatMessages = [];
    
    // Primero el prompt del sistema
    chatMessages.push({
      role: 'user',
      parts: [{ text: systemPrompt }]
    });
    
    chatMessages.push({
      role: 'model',
      parts: [{ text: 'Entendido. Actuaré como un asistente profesional y mantendré la conversación coherente.' }]
    });

    // Después añadir el historial previo
    if (chatHistory.length > 0) {
      for (let i = 0; i < chatHistory.length; i += 2) {
        if (i < chatHistory.length) {
          chatMessages.push({
            role: 'user',
            parts: [{ text: chatHistory[i] }]
          });
        }
        
        if (i + 1 < chatHistory.length) {
          chatMessages.push({
            role: 'model',
            parts: [{ text: chatHistory[i + 1] }]
          });
        }
      }
    }
    
    // Finalmente añadir el mensaje actual
    chatMessages.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    // Generar la respuesta utilizando el chat completo
    const result = await model.generateContent({
      contents: chatMessages,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1000,
      }
    });
    
    const response = result.response.text();
    return response;
  } catch (error: any) {
    console.error("Error generando respuesta con Gemini:", error);
    return "Lo siento, no pude generar una respuesta automática en este momento. Detalles del error: " + error.message;
  }
}

/**
 * Analiza un mensaje para extraer información relevante
 * @param message El mensaje a analizar
 * @returns Objetos con información extraída del mensaje
 */
export async function analyzeMessage(message: string): Promise<any> {
  try {
    if (!API_KEY) {
      return { success: false, error: "API Key de Gemini no configurada" };
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro"
    });

    const prompt = `
    Analiza el siguiente mensaje y extrae toda la información relevante.
    Organiza la información en formato JSON con las siguientes claves:
    - intención (consulta, queja, compra, información, otro)
    - sentimiento (positivo, negativo, neutral)
    - urgencia (alta, media, baja)
    - productos_mencionados (array)
    - cantidades_mencionadas (array)
    - precios_mencionados (array)
    - fechas_mencionadas (array)
    
    Mensaje: "${message}"
    
    Responde ÚNICAMENTE con un objeto JSON válido sin explicaciones adicionales.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      // Intentar parsear la respuesta como JSON
      const jsonResponse = JSON.parse(response.replace(/```json|```/g, '').trim());
      return { success: true, analysis: jsonResponse };
    } catch (parseError) {
      console.error("Error parseando respuesta JSON de Gemini:", parseError);
      return { success: false, error: "Formato de respuesta inválido", rawResponse: response };
    }
  } catch (error: any) {
    console.error("Error analizando mensaje con Gemini:", error);
    return { success: false, error: error.message };
  }
}