/**
 * Unified AI Provider Service - Integrates all 4 AI providers for natural responses
 * Supports: OpenAI, Gemini, Qwen, DeepSeek
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import axios from 'axios';

export interface AIProviderConfig {
  provider: 'openai' | 'gemini' | 'qwen' | 'deepseek';
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  provider: string;
  error?: string;
  confidence: number;
}

export class UnifiedAIProviderService {
  private openaiClient: OpenAI | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;
  private qwenApiKey: string | null = null;
  private deepseekApiKey: string | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✅ OpenAI provider initialized');
      }

      // Initialize Gemini
      if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        this.geminiClient = new GoogleGenerativeAI(apiKey!);
        console.log('✅ Gemini provider initialized');
      }

      // Initialize Qwen
      if (process.env.QWEN_API_KEY) {
        this.qwenApiKey = process.env.QWEN_API_KEY;
        console.log('✅ Qwen provider initialized');
      }

      // Initialize DeepSeek
      if (process.env.DEEPSEEK_API_KEY) {
        this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
        console.log('✅ DeepSeek provider initialized');
      }

      console.log('🤖 Unified AI Provider Service ready');
    } catch (error) {
      console.error('❌ Error initializing AI providers:', error);
    }
  }

  /**
   * Generate response using specified AI provider
   */
  async generateResponse(
    userMessage: string,
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const { provider, temperature = 0.8, maxTokens = 150, systemPrompt } = config;

    // Build natural conversation prompt
    const naturalPrompt = this.buildNaturalPrompt(userMessage, systemPrompt);

    try {
      switch (provider) {
        case 'openai':
          return await this.callOpenAI(naturalPrompt, temperature, maxTokens);
        case 'gemini':
          return await this.callGemini(naturalPrompt, temperature, maxTokens);
        case 'qwen':
          return await this.callQwen(naturalPrompt, temperature, maxTokens);
        case 'deepseek':
          return await this.callDeepSeek(naturalPrompt, temperature, maxTokens);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`❌ Error with ${provider}:`, error);
      return {
        success: false,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0
      };
    }
  }

  /**
   * Generate response with automatic provider fallback
   */
  async generateWithFallback(
    userMessage: string,
    preferredProvider: string = 'gemini'
  ): Promise<AIResponse> {
    const providers = ['gemini', 'openai', 'deepseek', 'qwen'];
    
    // Try preferred provider first
    if (providers.includes(preferredProvider)) {
      providers.unshift(preferredProvider);
    }

    for (const provider of [...new Set(providers)]) {
      try {
        const result = await this.generateResponse(userMessage, {
          provider: provider as any,
          temperature: 0.8,
          maxTokens: 150
        });

        if (result.success && result.message) {
          console.log(`✅ Response generated using ${provider}`);
          return result;
        }
      } catch (error) {
        console.log(`⚠️ ${provider} failed, trying next provider...`);
        continue;
      }
    }

    // Return fallback response if all providers fail
    return this.generateFallbackResponse();
  }

  private buildNaturalPrompt(userMessage: string, systemPrompt?: string): string {
    const basePrompt = systemPrompt || `Eres un asistente de WhatsApp natural y auténtico.

REGLAS ESTRICTAS - NUNCA uses estas frases:
❌ "Gracias por escribirnos"
❌ "Le saluda [nombre]"
❌ "Departamento de"
❌ "Sistema Municipal"
❌ "Estoy aquí para apoyarle"
❌ "Servicio al Cliente"

PERSONALIDAD REQUERIDA:
- Habla como una persona real
- Usa lenguaje cotidiano de WhatsApp
- Sé específico y directo
- Máximo 120 caracteres
- Usa 1-2 emojis si es natural
- Responde en primera persona`;

    return `${basePrompt}

Usuario: "${userMessage}"

Genera UNA respuesta natural y específica:`;
  }

  private async callOpenAI(prompt: string, temperature: number, maxTokens: number): Promise<AIResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un asistente de WhatsApp natural. Responde brevemente y de forma auténtica." },
        { role: "user", content: prompt }
      ],
      temperature,
      max_tokens: maxTokens
    });

    const message = completion.choices[0]?.message?.content?.trim();
    
    if (!message) {
      throw new Error('No response from OpenAI');
    }

    return {
      success: true,
      message: this.cleanResponse(message),
      provider: 'openai',
      confidence: 90
    };
  }

  private async callGemini(prompt: string, temperature: number, maxTokens: number): Promise<AIResponse> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    const model = this.geminiClient.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const message = response.text()?.trim();

    if (!message) {
      throw new Error('No response from Gemini');
    }

    return {
      success: true,
      message: this.cleanResponse(message),
      provider: 'gemini',
      confidence: 85
    };
  }

  private async callQwen(prompt: string, temperature: number, maxTokens: number): Promise<AIResponse> {
    if (!this.qwenApiKey) {
      throw new Error('Qwen API key not configured');
    }

    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-max',
        input: {
          messages: [
            { role: 'system', content: 'Eres un asistente de WhatsApp natural y auténtico.' },
            { role: 'user', content: prompt }
          ]
        },
        parameters: {
          temperature,
          max_tokens: maxTokens,
          top_p: 0.8,
          result_format: 'message'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.qwenApiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable'
        },
        timeout: 15000
      }
    );

    const message = response.data?.output?.choices?.[0]?.message?.content ||
                   response.data?.output?.text;

    if (!message) {
      throw new Error('No response from Qwen');
    }

    return {
      success: true,
      message: this.cleanResponse(message),
      provider: 'qwen',
      confidence: 80
    };
  }

  private async callDeepSeek(prompt: string, temperature: number, maxTokens: number): Promise<AIResponse> {
    if (!this.deepseekApiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Eres un asistente de WhatsApp natural y auténtico.' },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: 0.95
      },
      {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const message = response.data?.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error('No response from DeepSeek');
    }

    return {
      success: true,
      message: this.cleanResponse(message),
      provider: 'deepseek',
      confidence: 85
    };
  }

  private cleanResponse(response: string): string {
    // Remove generic phrases
    const cleaned = response
      .replace(/gracias por escribir(nos|te)/gi, '')
      .replace(/le saluda \w+/gi, '')
      .replace(/departamento de \w+/gi, '')
      .replace(/sistema municipal/gi, '')
      .replace(/estoy aquí para apoyar(le|te)/gi, '')
      .replace(/servicio al (cliente|ciudadano)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If too short after cleaning, return natural fallback
    if (cleaned.length < 10) {
      const fallbacks = [
        "¡Hola! ¿En qué te ayudo?",
        "¡Hey! ¿Qué necesitas?",
        "¡Buenas! ¿Cómo puedo ayudarte?",
        "¡Hola! Dime, ¿en qué te apoyo?"
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    return cleaned;
  }

  private generateFallbackResponse(): AIResponse {
    const fallbacks = [
      "¡Hola! ¿En qué te puedo ayudar?",
      "¡Hey! Cuéntame, ¿qué necesitas?",
      "¡Buenas! ¿Cómo puedo ayudarte?",
      "¡Hola! ¿Qué buscas hoy?",
      "¡Hey! ¿Qué tal? ¿En qué te apoyo?"
    ];

    return {
      success: true,
      message: fallbacks[Math.floor(Math.random() * fallbacks.length)],
      provider: 'fallback',
      confidence: 60
    };
  }

  /**
   * Get available providers status
   */
  getProviderStatus(): Record<string, boolean> {
    return {
      openai: !!this.openaiClient,
      gemini: !!this.geminiClient,
      qwen: !!this.qwenApiKey,
      deepseek: !!this.deepseekApiKey
    };
  }

  /**
   * Test all providers
   */
  async testAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const testMessage = "Hola, ¿cómo estás?";

    for (const provider of ['openai', 'gemini', 'qwen', 'deepseek']) {
      try {
        const result = await this.generateResponse(testMessage, {
          provider: provider as any,
          temperature: 0.7,
          maxTokens: 50
        });
        results[provider] = result.success;
        console.log(`${provider}: ${result.success ? '✅' : '❌'}`);
      } catch (error) {
        results[provider] = false;
        console.log(`${provider}: ❌`);
      }
    }

    return results;
  }
}

export const unifiedAIProvider = new UnifiedAIProviderService();