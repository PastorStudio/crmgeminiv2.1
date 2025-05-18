/**
 * Gestor de claves API para modelos IA
 * Versión optimizada para servidor de producción
 */

// Función para obtener la clave API de Gemini
export function getGeminiApiKey(): { key: string | null, isClientKey: boolean } {
  try {
    // Usar la clave de entorno del servidor
    const serverApiKey = process.env.GEMINI_API_KEY;
    
    if (serverApiKey) {
      // Verificar si parece ser una clave de cliente (empiezan con AIza y son más cortas)
      const isClientKey = serverApiKey.startsWith('AIza') && serverApiKey.length < 50;
      
      if (isClientKey) {
        console.warn('ADVERTENCIA: La clave GEMINI_API_KEY parece ser una clave de cliente.');
        console.warn('En un servidor de producción, debe usar una clave de API de servidor de Vertex AI.');
        console.warn('Obtenga una clave adecuada en: https://cloud.google.com/vertex-ai/docs/generative-ai/start/setup-vertex-ai-api');
      }
      
      return { key: serverApiKey, isClientKey };
    }
    
    // Si no hay clave, retornar null
    console.error('No se encontró clave API para Gemini.');
    return { key: null, isClientKey: false };
  } catch (error) {
    console.error('Error al obtener clave API de Gemini:', error);
    return { key: null, isClientKey: false };
  }
}

// Función para obtener la clave API de OpenAI
export function getOpenAIApiKey(): string | null {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('No se encontró clave API para OpenAI.');
      return null;
    }
    
    return apiKey;
  } catch (error) {
    console.error('Error al obtener clave API de OpenAI:', error);
    return null;
  }
}