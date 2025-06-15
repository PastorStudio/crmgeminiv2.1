/**
 * Unified AI Provider Service
 * Handles multiple AI providers: OpenAI, Gemini, Qwen3
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { eq } from 'drizzle-orm';
import { pool } from '../db';

interface AIConfig {
  selectedProvider: string;
  geminiApiKey: string;
  openaiApiKey: string;
  qwenApiKey: string;
  deepseekApiKey: string;
  customPrompt: string;
  temperature: number;
}

export class AIProviderService {
  private config: AIConfig | null = null;
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  async initialize(): Promise<void> {
    try {
      // Get AI configuration from auto_response_config table
      const result = await pool.query('SELECT * FROM auto_response_config WHERE account_id = 1 LIMIT 1');
      
      if (result.rows.length === 0) {
        console.log('⚠️ No AI configuration found in database, using default DeepSeek');
        this.config = {
          selectedProvider: 'deepseek',
          geminiApiKey: '',
          openaiApiKey: '',
          qwenApiKey: '',
          deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
          customPrompt: 'Eres un asistente virtual profesional de atención al cliente. Responde de manera amable y profesional en español.',
          temperature: 0.7
        };
      } else {
        const dbConfig = result.rows[0];
        const settings = typeof dbConfig.settings === 'string' ? JSON.parse(dbConfig.settings) : dbConfig.settings || {};
        
        this.config = {
          selectedProvider: settings.selectedProvider || 'deepseek',
          geminiApiKey: dbConfig.gemini_api_key || '',
          openaiApiKey: settings.openaiApiKey || '',
          qwenApiKey: settings.qwenApiKey || '',
          deepseekApiKey: settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '',
          customPrompt: settings.customPrompt || 'Eres un asistente virtual profesional de atención al cliente. Responde de manera amable y profesional en español.',
          temperature: settings.temperature || 0.7
        };
      }

      // Initialize providers based on configuration
      this.initializeProviders();
      
      console.log(`✅ AI Provider Service initialized with provider: ${this.config.selectedProvider}`);
    } catch (error) {
      console.error('❌ Error initializing AI Provider Service:', error);
    }
  }

  private initializeProviders(): void {
    if (!this.config) return;

    // Initialize OpenAI
    if (this.config.openaiApiKey && this.config.openaiApiKey !== 'placeholder') {
      this.openai = new OpenAI({
        apiKey: this.config.openaiApiKey
      });
      console.log('✅ OpenAI client initialized');
    }

    // Initialize Gemini
    if (this.config.geminiApiKey && this.config.geminiApiKey !== 'placeholder') {
      this.gemini = new GoogleGenerativeAI(this.config.geminiApiKey);
      console.log('✅ Gemini client initialized');
    }

    // Qwen3 initialization would go here when API is available
    if (this.config.qwenApiKey && this.config.qwenApiKey !== 'placeholder') {
      console.log('✅ Qwen3 API key configured');
    }

    // DeepSeek initialization
    if (this.config.deepseekApiKey && this.config.deepseekApiKey !== 'placeholder') {
      console.log('✅ DeepSeek API key configured');
    }
  }

  async generateResponse(message: string, agentName: string = 'Asistente AI'): Promise<string> {
    if (!this.config) {
      await this.initialize();
    }

    if (!this.config) {
      return this.getFallbackResponse();
    }

    try {
      const systemPrompt = this.config.customPrompt || `Eres ${agentName}, un asistente virtual profesional.`;
      
      switch (this.config.selectedProvider) {
        case 'openai':
          try {
            return await this.generateOpenAIResponse(message, systemPrompt);
          } catch (openaiError: any) {
            if (openaiError.status === 429 || openaiError.code === 'insufficient_quota') {
              console.log('🔄 OpenAI quota exceeded, falling back to DeepSeek...');
              if (process.env.DEEPSEEK_API_KEY) {
                return await this.generateDeepSeekResponse(message, systemPrompt);
              }
            }
            throw openaiError;
          }
        
        case 'gemini':
          return await this.generateGeminiResponse(message, systemPrompt);
        
        case 'qwen3':
          return await this.generateQwenResponse(message, systemPrompt);
        
        case 'deepseek':
          return await this.generateDeepSeekResponse(message, systemPrompt);
        
        default:
          console.log(`⚠️ Provider ${this.config.selectedProvider} not supported, using DeepSeek fallback`);
          if (process.env.DEEPSEEK_API_KEY) {
            return await this.generateDeepSeekResponse(message, systemPrompt);
          }
          return this.getFallbackResponse();
      }
    } catch (error) {
      console.error(`❌ Error generating response with ${this.config.selectedProvider}:`, error);
      // Try DeepSeek as final fallback if available
      if (process.env.DEEPSEEK_API_KEY && this.config.selectedProvider !== 'deepseek') {
        try {
          console.log('🔄 Trying DeepSeek as final fallback...');
          const systemPrompt = this.config.customPrompt || `Eres ${agentName}, un asistente virtual profesional.`;
          return await this.generateDeepSeekResponse(message, systemPrompt);
        } catch (deepseekError) {
          console.error('❌ DeepSeek fallback also failed:', deepseekError);
        }
      }
      return this.getFallbackResponse();
    }
  }

  private async generateOpenAIResponse(message: string, systemPrompt: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: this.config?.temperature || 0.7,
      max_tokens: 500
    });

    return completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
  }

  private async generateGeminiResponse(message: string, systemPrompt: string): Promise<string> {
    if (!this.gemini) {
      throw new Error('Gemini client not initialized');
    }

    const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `${systemPrompt}\n\nUsuario: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || 'Lo siento, no pude generar una respuesta.';
  }

  private async generateQwenResponse(message: string, systemPrompt: string): Promise<string> {
    if (!this.config?.qwenApiKey) {
      throw new Error('Qwen API key not configured');
    }

    // Qwen3 API implementation using OpenRouter
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.qwenApiKey}`,
          'HTTP-Referer': 'https://geminicrm.online',
          'X-Title': 'WhatsApp CRM AI'
        },
        body: JSON.stringify({
          model: 'qwen/qwen-2.5-72b-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: this.config.temperature,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
    } catch (error) {
      console.error('❌ Error with Qwen API:', error);
      throw error;
    }
  }

  private async generateDeepSeekResponse(message: string, systemPrompt: string): Promise<string> {
    const apiKey = this.config?.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    // DeepSeek API implementation
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: this.config.temperature,
          max_tokens: 500,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
    } catch (error) {
      console.error('❌ Error with DeepSeek API:', error);
      throw error;
    }
  }

  private getFallbackResponse(): string {
    const fallbackResponses = [
      'Gracias por tu mensaje. Te responderemos pronto.',
      'Hemos recibido tu consulta y la atenderemos a la brevedad.',
      'Tu mensaje es importante para nosotros. Te contactaremos pronto.',
      'Estamos aquí para ayudarte. Un representante te responderá pronto.',
      'Apreciamos tu contacto. Te responderemos lo antes posible.'
    ];

    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  async refreshConfig(): Promise<void> {
    this.config = null;
    this.openai = null;
    this.gemini = null;
    await this.initialize();
  }
}

// Export singleton instance
export const aiProviderService = new AIProviderService();