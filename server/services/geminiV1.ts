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
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
      
      const response = await axios.post(url, {
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
      });
      
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
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
      
      const response = await axios.post(url, {
        contents: messages,
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.8,
          topK: config.topK ?? 40,
          maxOutputTokens: config.maxOutputTokens ?? 800,
          stopSequences: config.stopSequences
        }
      });
      
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