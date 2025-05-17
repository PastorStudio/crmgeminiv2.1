/**
 * Módulo para interactuar directamente con la API de Gemini v1
 * Implementación personalizada para evitar los errores 404 de la biblioteca oficial
 * que sigue usando v1beta como valor predeterminado
 */

import axios from 'axios';

interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

interface GeminiContent {
  parts: Array<{text?: string}>;
}

interface GeminiMessage {
  role: string;
  parts: Array<{text: string}>;
}

export class GeminiV1Client {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1';
  }
  
  /**
   * Genera contenido con el modelo Gemini
   */
  async generateContent(prompt: string, model: string = 'gemini-pro', config: GenerationConfig = {}): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error("API key no configurada para Gemini");
      }
      
      // Verificar si estamos usando una API key de servidor o una API key de cliente
      const isClientKey = this.apiKey.startsWith('AIzaSy');
      
      // Si es una clave de cliente, usar la API directamente que funciona con esa clave
      if (isClientKey) {
        // Intentar usar la clave de la variable de entorno como respaldo
        const serverKey = process.env.GEMINI_API_KEY;
        if (serverKey && !serverKey.startsWith('AIzaSy')) {
          console.log("Usando clave de servidor de variable de entorno para Gemini");
          this.apiKey = serverKey;
        } else {
          console.log("AVISO: Usando clave de cliente para Gemini en el servidor. Esto puede causar errores.");
        }
      }
      
      // Usar directamente la URL v1 evitando cualquier manipulación
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${this.apiKey}`;
      
      console.log("Modelo Gemini utilizado:", model);
      
      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.8,
          topK: config.topK ?? 40,
          maxOutputTokens: config.maxOutputTokens ?? 800,
          stopSequences: config.stopSequences
        }
      };
      
      console.log("Enviando solicitud a Gemini v1 con prompt:", prompt.substring(0, 100) + "...");
      
      const response = await axios.post(url, requestBody);
      
      if (response.data && response.data.candidates && response.data.candidates.length > 0) {
        const content = response.data.candidates[0].content;
        if (content && content.parts && content.parts.length > 0) {
          return content.parts[0].text || '';
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error generando contenido con Gemini v1:', error);
      throw error;
    }
  }
  
  /**
   * Implementación simplificada de chat con Gemini
   */
  async chat(messages: GeminiMessage[], model: string = 'gemini-pro', config: GenerationConfig = {}): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error("API key no configurada para Gemini");
      }
      
      // Verificar si estamos usando una API key de servidor o una API key de cliente
      const isClientKey = this.apiKey.startsWith('AIzaSy');
      
      // Si es una clave de cliente, usar la API directamente que funciona con esa clave
      if (isClientKey) {
        // Intentar usar la clave de la variable de entorno como respaldo
        const serverKey = process.env.GEMINI_API_KEY;
        if (serverKey && !serverKey.startsWith('AIzaSy')) {
          console.log("Usando clave de servidor de variable de entorno para Gemini (chat)");
          this.apiKey = serverKey;
        } else {
          console.log("AVISO: Usando clave de cliente para Gemini en el servidor (chat). Esto puede causar errores.");
        }
      }
      
      // Usar directamente la URL v1 evitando cualquier manipulación
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${this.apiKey}`;
      
      console.log("Modelo Gemini utilizado para chat:", model);
      
      const requestBody = {
        contents: messages,
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.8,
          topK: config.topK ?? 40,
          maxOutputTokens: config.maxOutputTokens ?? 800,
          stopSequences: config.stopSequences
        }
      };
      
      console.log("Enviando solicitud de chat a Gemini v1");
      
      const response = await axios.post(url, requestBody);
      
      if (response.data && response.data.candidates && response.data.candidates.length > 0) {
        const content = response.data.candidates[0].content;
        if (content && content.parts && content.parts.length > 0) {
          return content.parts[0].text || '';
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error en chat con Gemini v1:', error);
      throw error;
    }
  }
}