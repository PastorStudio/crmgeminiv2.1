import puppeteer from 'puppeteer';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface DeepSeekConfig {
  id: string;
  accountId: number;
  isEnabled: boolean;
  chatUrl: string;
  temperature: number;
  responseStyle: 'analytical' | 'creative' | 'balanced' | 'detailed';
  maxRecommendations: number;
  createdAt: Date;
  updatedAt: Date;
}

interface RecommendationRequest {
  chatId: string;
  accountId: number;
  context: string;
  userMessage: string;
  timestamp: number;
  processed: boolean;
}

interface RecommendationResponse {
  recommendations: string[];
  analysis: string;
  confidence: number;
  timestamp: number;
}

class DeepSeekRecommendationSystem {
  private configs: Map<number, DeepSeekConfig> = new Map();
  private pendingRequests: RecommendationRequest[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private browser: puppeteer.Browser | null = null;
  private isRunning = false;

  constructor() {}

  async initialize(): Promise<void> {
    console.log('🧠 Inicializando sistema de recomendaciones DeepSeek...');
    
    try {
      // Create configs table if not exists
      await this.createConfigTable();
      
      // Load existing configurations
      await this.loadConfigurations();
      
      // Initialize browser
      await this.initializeBrowser();
      
      // Start processing
      this.startProcessing();
      
      console.log('✅ Sistema de recomendaciones DeepSeek inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando sistema de recomendaciones DeepSeek:', error);
    }
  }

  private async createConfigTable(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS deepseek_configs (
          id TEXT PRIMARY KEY,
          account_id INTEGER UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          chat_url TEXT DEFAULT '',
          temperature DECIMAL(3,2) DEFAULT 0.7,
          response_style TEXT DEFAULT 'balanced',
          max_recommendations INTEGER DEFAULT 3,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Tabla deepseek_configs verificada/creada');
    } catch (error) {
      console.error('Error creating deepseek_configs table:', error);
    }
  }

  private async loadConfigurations(): Promise<void> {
    try {
      const result = await db.execute(sql`SELECT * FROM deepseek_configs`);
      const configs = result.rows as any[];
      
      configs.forEach(config => {
        this.configs.set(config.account_id, {
          id: config.id,
          accountId: config.account_id,
          isEnabled: config.is_enabled,
          chatUrl: config.chat_url,
          temperature: config.temperature,
          responseStyle: config.response_style,
          maxRecommendations: config.max_recommendations,
          createdAt: new Date(config.created_at),
          updatedAt: new Date(config.updated_at)
        });
      });

      console.log(`📋 Cargadas ${configs.length} configuraciones de DeepSeek`);
    } catch (error) {
      console.error('Error loading DeepSeek configurations:', error);
    }
  }

  private async initializeBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      console.log('🌐 Browser inicializado para DeepSeek');
    } catch (error) {
      console.error('Error initializing browser:', error);
    }
  }

  async createOrUpdateConfig(accountId: number, config: Partial<DeepSeekConfig>): Promise<DeepSeekConfig> {
    const configId = `deepseek_${accountId}`;
    const now = new Date().toISOString();
    
    const newConfig: DeepSeekConfig = {
      id: configId,
      accountId,
      isEnabled: config.isEnabled ?? false,
      chatUrl: config.chatUrl ?? '',
      temperature: config.temperature ?? 0.7,
      responseStyle: config.responseStyle ?? 'balanced',
      maxRecommendations: config.maxRecommendations ?? 3,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // Use PostgreSQL UPSERT syntax instead of SQLite INSERT OR REPLACE
      await db.execute(sql`
        INSERT INTO deepseek_configs 
        (id, account_id, is_enabled, chat_url, temperature, response_style, max_recommendations, created_at, updated_at)
        VALUES (${configId}, ${accountId}, ${newConfig.isEnabled}, ${newConfig.chatUrl}, ${newConfig.temperature}, 
                ${newConfig.responseStyle}, ${newConfig.maxRecommendations}, ${now}, ${now})
        ON CONFLICT (account_id) 
        DO UPDATE SET 
          is_enabled = EXCLUDED.is_enabled,
          chat_url = EXCLUDED.chat_url,
          temperature = EXCLUDED.temperature,
          response_style = EXCLUDED.response_style,
          max_recommendations = EXCLUDED.max_recommendations,
          updated_at = EXCLUDED.updated_at
      `);

      this.configs.set(accountId, newConfig);
      console.log(`💾 Configuración DeepSeek guardada para cuenta ${accountId}`);
      
      return newConfig;
    } catch (error) {
      console.error('Error saving DeepSeek configuration:', error);
      throw error;
    }
  }

  async activateRecommendations(accountId: number, chatUrl: string): Promise<boolean> {
    try {
      const config = this.configs.get(accountId);
      if (!config) {
        await this.createOrUpdateConfig(accountId, { isEnabled: true, chatUrl });
      } else {
        await this.createOrUpdateConfig(accountId, { ...config, isEnabled: true, chatUrl });
      }
      
      console.log(`🟢 Recomendaciones DeepSeek activadas para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error activating DeepSeek for account ${accountId}:`, error);
      return false;
    }
  }

  async deactivateRecommendations(accountId: number): Promise<boolean> {
    try {
      const config = this.configs.get(accountId);
      if (config) {
        await this.createOrUpdateConfig(accountId, { ...config, isEnabled: false });
      }
      
      console.log(`🔴 Recomendaciones DeepSeek desactivadas para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error deactivating DeepSeek for account ${accountId}:`, error);
      return false;
    }
  }

  addRecommendationRequest(chatId: string, accountId: number, context: string, userMessage: string): void {
    const config = this.configs.get(accountId);
    if (!config || !config.isEnabled || !config.chatUrl) {
      return;
    }

    const request: RecommendationRequest = {
      chatId,
      accountId,
      context: context.trim(),
      userMessage: userMessage.trim(),
      timestamp: Date.now(),
      processed: false
    };

    this.pendingRequests.push(request);
    console.log(`🧠 Solicitud de recomendación agregada: ${chatId} - ${userMessage.substring(0, 50)}...`);
  }

  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      await this.processRequests();
    }, 5000); // Check every 5 seconds

    this.isRunning = true;
    console.log('🔄 Procesador de recomendaciones DeepSeek iniciado');
  }

  private async processRequests(): Promise<void> {
    if (this.pendingRequests.length === 0) return;

    const requestsToProcess = this.pendingRequests.filter(req => !req.processed);
    
    for (const request of requestsToProcess) {
      try {
        await this.processRequest(request);
        request.processed = true;
      } catch (error) {
        console.error('Error processing recommendation request:', error);
        request.processed = true; // Mark as processed to avoid retry loop
      }
    }

    // Clean up processed requests
    this.pendingRequests = this.pendingRequests.filter(req => !req.processed);
  }

  private async processRequest(request: RecommendationRequest): Promise<void> {
    const config = this.configs.get(request.accountId);
    if (!config || !config.isEnabled || !config.chatUrl) return;

    console.log(`🧠 Generando recomendaciones para: ${request.chatId}`);

    try {
      const recommendations = await this.generateRecommendations(request, config);
      
      if (recommendations) {
        await this.sendRecommendations(request.chatId, request.accountId, recommendations);
      }
    } catch (error) {
      console.error('Error generating/sending recommendations:', error);
    }
  }

  private async generateRecommendations(request: RecommendationRequest, config: DeepSeekConfig): Promise<RecommendationResponse | null> {
    if (!this.browser) {
      console.error('Browser not initialized');
      return null;
    }

    let page: puppeteer.Page | null = null;
    
    try {
      page = await this.browser.newPage();
      
      // Set user agent and other headers
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      // Navigate to DeepSeek chat
      await page.goto(config.chatUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for chat interface to load
      await page.waitForSelector('textarea, input[type="text"]', { timeout: 10000 });
      
      // Prepare the prompt
      const prompt = this.buildRecommendationPrompt(request, config);
      
      // Find and interact with the input field
      const inputSelector = 'textarea, input[type="text"]';
      await page.focus(inputSelector);
      await page.type(inputSelector, prompt);
      
      // Submit the message
      const submitButton = await page.$('button[type="submit"], button:contains("Send"), button:contains("Enviar")');
      if (submitButton) {
        await submitButton.click();
      } else {
        await page.keyboard.press('Enter');
      }
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Extract the response
      const responseText = await page.evaluate(() => {
        // Try different selectors for the response
        const selectors = [
          '[data-testid="conversation"] > div:last-child',
          '.message:last-child',
          '.chat-message:last-child',
          '.response:last-child',
          'div[class*="message"]:last-child'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        
        return null;
      });
      
      if (responseText) {
        // Try to parse as JSON, if it fails, format the response
        try {
          const jsonResponse = JSON.parse(responseText);
          return jsonResponse;
        } catch {
          // Format non-JSON response
          return this.formatDeepSeekResponse(responseText, config);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in DeepSeek web scraping:', error);
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private buildRecommendationPrompt(request: RecommendationRequest, config: DeepSeekConfig): string {
    const stylePrompts = {
      analytical: 'Proporciona un análisis detallado y lógico.',
      creative: 'Sé creativo y piensa fuera de la caja.',
      balanced: 'Mantén un equilibrio entre análisis y creatividad.',
      detailed: 'Proporciona explicaciones detalladas y exhaustivas.'
    };

    return `Como experto en análisis de conversaciones y recomendaciones, analiza la siguiente conversación de WhatsApp y proporciona recomendaciones útiles.

Contexto de la conversación:
${request.context}

Último mensaje del usuario:
${request.userMessage}

${stylePrompts[config.responseStyle]}

Responde ÚNICAMENTE en formato JSON con esta estructura exacta:
{
  "recommendations": [
    "Recomendación 1",
    "Recomendación 2", 
    "Recomendación 3"
  ],
  "analysis": "Tu análisis de la situación",
  "confidence": 0.85,
  "timestamp": ${Date.now()}
}

Limita a máximo ${config.maxRecommendations} recomendaciones prácticas y actionables.`;
  }

  private formatDeepSeekResponse(responseText: string, config: DeepSeekConfig): RecommendationResponse {
    // Extract recommendations from text response
    const lines = responseText.split('\n').filter(line => line.trim());
    const recommendations: string[] = [];
    let analysis = '';
    
    let isRecommendationSection = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('recomendacion') || line.toLowerCase().includes('sugerencia')) {
        isRecommendationSection = true;
        continue;
      }
      
      if (isRecommendationSection && recommendations.length < config.maxRecommendations) {
        if (line.match(/^\d+\./) || line.startsWith('-') || line.startsWith('•')) {
          recommendations.push(line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim());
        }
      } else if (!isRecommendationSection) {
        analysis += line + ' ';
      }
    }
    
    // Fallback if no structured recommendations found
    if (recommendations.length === 0) {
      const sentences = responseText.split('.').filter(s => s.trim().length > 10);
      recommendations.push(...sentences.slice(0, config.maxRecommendations).map(s => s.trim()));
    }
    
    return {
      recommendations: recommendations.slice(0, config.maxRecommendations),
      analysis: analysis.trim() || 'Análisis basado en la conversación proporcionada.',
      confidence: 0.75,
      timestamp: Date.now()
    };
  }

  private async sendRecommendations(chatId: string, accountId: number, recommendations: RecommendationResponse): Promise<void> {
    try {
      const message = this.formatRecommendationsMessage(recommendations);
      
      // Send message using direct HTTP request to avoid Vite interception
      const payload = {
        chatId,
        message,
        accountId
      };

      // Use Node.js fetch to bypass Vite
      const fetch = (await import('node-fetch')).default;
      const serverResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DeepSeekRecommendationSystem/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (serverResponse.ok) {
        console.log(`✅ Recomendaciones DeepSeek enviadas a ${chatId}`);
      } else {
        console.error(`❌ Error enviando recomendaciones DeepSeek: ${serverResponse.status}`);
      }
    } catch (error) {
      console.error('Error sending DeepSeek recommendations:', error);
    }
  }

  private formatRecommendationsMessage(recommendations: RecommendationResponse): string {
    let message = '🧠 *Recomendaciones AI (DeepSeek)*\n\n';
    
    message += `📊 *Análisis:*\n${recommendations.analysis}\n\n`;
    
    message += `💡 *Recomendaciones:*\n`;
    recommendations.recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec}\n`;
    });
    
    message += `\n🎯 *Confianza:* ${Math.round(recommendations.confidence * 100)}%`;
    
    return message;
  }

  getConfig(accountId: number): DeepSeekConfig | undefined {
    return this.configs.get(accountId);
  }

  getAllConfigs(): DeepSeekConfig[] {
    return Array.from(this.configs.values());
  }

  isEnabled(accountId: number): boolean {
    const config = this.configs.get(accountId);
    return config ? config.isEnabled : false;
  }

  async stop(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.isRunning = false;
    console.log('⏹️ Sistema de recomendaciones DeepSeek detenido');
  }
}

export const deepseekRecommendationSystem = new DeepSeekRecommendationSystem();
export type { DeepSeekConfig, RecommendationRequest, RecommendationResponse };