import { GoogleGenerativeAI } from '@google/generative-ai';

// Variables para almacenar la configuración dinámica de Gemini
let API_KEY = '';
let MODEL_NAME = 'gemini-pro'; // Modelo por defecto (más estable y con más cuota)
let PREFERRED_MODEL = 'gemini-1.5-pro'; // Modelo preferido (si está disponible)

// Función para cargar la clave API dinámicamente desde el servidor
async function loadApiKey() {
  try {
    const response = await fetch('/api/settings/gemini-client-key');
    
    if (!response.ok) {
      throw new Error('No se pudo obtener la clave API de Gemini');
    }
    
    const data = await response.json();
    
    if (data.success && data.apiKey) {
      API_KEY = data.apiKey;
      // Si el servidor indica qué modelo usar, lo actualizamos
      if (data.model) {
        // Guardamos el modelo preferido (de alta capacidad pero con posibles límites de cuota)
        PREFERRED_MODEL = data.model;
        
        // Usamos el modelo recomendado si se proporciona uno
        if (data.recommendedModel) {
          MODEL_NAME = data.recommendedModel;
        } else {
          // Si no hay modelo recomendado, intentamos con el preferido
          MODEL_NAME = PREFERRED_MODEL;
        }
      }
      console.log('Estado de la clave API de Gemini: Configurada');
      console.log('Modelo Gemini a utilizar:', MODEL_NAME);
      return true;
    } else {
      console.warn('No se encontró una clave API válida para Gemini');
      return false;
    }
  } catch (error) {
    console.error('Error cargando clave API de Gemini:', error);
    return false;
  }
}

// Cargar la clave API al inicializar
loadApiKey().catch(err => {
  console.error('Error inicializando Gemini:', err);
});

// Función para obtener una instancia de Gemini con la clave API actual
function getGeminiInstance() {
  if (!API_KEY) {
    throw new Error('No hay una clave API de Gemini configurada');
  }
  return new GoogleGenerativeAI(API_KEY);
}

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
    // Asegurarse de que tenemos una clave API
    if (!API_KEY) {
      // Intentar cargar la clave API si no está disponible
      const loaded = await loadApiKey();
      if (!loaded) {
        return "No se pudo generar respuesta automática. API Key de Gemini no configurada.";
      }
    }

    // Obtener instancia actualizada de Gemini
    const genAI = getGeminiInstance();
    
    // Acceder al modelo de generación de texto con el modelo indicado desde el servidor
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME
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
    // Asegurarse de que tenemos una clave API
    if (!API_KEY) {
      // Intentar cargar la clave API si no está disponible
      const loaded = await loadApiKey();
      if (!loaded) {
        return { success: false, error: "API Key de Gemini no configurada" };
      }
    }

    // Obtener instancia actualizada de Gemini
    const genAI = getGeminiInstance();
    
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME
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