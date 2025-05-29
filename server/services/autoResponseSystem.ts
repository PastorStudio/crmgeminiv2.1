import OpenAI from 'openai';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface AutoResponseConfig {
  id: string;
  accountId: number;
  isEnabled: boolean;
  prompt: string;
  temperature: number; // 0.0 to 1.0 (professional to creative)
  responseStyle: 'professional' | 'friendly' | 'casual' | 'humorous';
  responseDelay: number; // seconds
  maxTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PendingMessage {
  chatId: string;
  accountId: number;
  message: string;
  timestamp: number;
  processed: boolean;
}

class AutoResponseSystem {
  private openai: OpenAI;
  private configs: Map<number, AutoResponseConfig> = new Map();
  private pendingMessages: PendingMessage[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    });
  }

  async initialize(): Promise<void> {
    console.log('🤖 Inicializando sistema de respuestas automáticas...');
    
    try {
      // Create configs table if not exists
      await this.createConfigTable();
      
      // Load existing configurations
      await this.loadConfigurations();
      
      // Start message processing
      this.startProcessing();
      
      console.log('✅ Sistema de respuestas automáticas inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando sistema de respuestas automáticas:', error);
    }
  }

  private async createConfigTable(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS auto_response_configs (
          id TEXT PRIMARY KEY,
          account_id INTEGER UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT false,
          prompt TEXT DEFAULT 'Eres un asistente virtual profesional. Responde de manera útil y cortés.',
          temperature DECIMAL(3,2) DEFAULT 0.7,
          response_style TEXT DEFAULT 'professional',
          response_delay INTEGER DEFAULT 3,
          max_tokens INTEGER DEFAULT 150,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Tabla auto_response_configs verificada/creada');
    } catch (error) {
      console.error('Error creating auto_response_configs table:', error);
    }
  }

  private async loadConfigurations(): Promise<void> {
    try {
      const result = await db.execute(sql`SELECT * FROM auto_response_configs`);
      const configs = result.rows as any[];
      
      configs.forEach(config => {
        this.configs.set(config.account_id, {
          id: config.id,
          accountId: config.account_id,
          isEnabled: config.is_enabled,
          prompt: config.prompt,
          temperature: config.temperature,
          responseStyle: config.response_style,
          responseDelay: config.response_delay,
          maxTokens: config.max_tokens,
          createdAt: new Date(config.created_at),
          updatedAt: new Date(config.updated_at)
        });
      });

      console.log(`📋 Cargadas ${configs.length} configuraciones de respuesta automática`);
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  }

  async createOrUpdateConfig(accountId: number, config: Partial<AutoResponseConfig>): Promise<AutoResponseConfig> {
    const configId = `config_${accountId}`;
    const now = new Date().toISOString();
    
    const newConfig: AutoResponseConfig = {
      id: configId,
      accountId,
      isEnabled: config.isEnabled ?? false,
      prompt: config.prompt ?? 'Eres un asistente virtual profesional. Responde de manera útil y cortés.',
      temperature: config.temperature ?? 0.7,
      responseStyle: config.responseStyle ?? 'professional',
      responseDelay: config.responseDelay ?? 3,
      maxTokens: config.maxTokens ?? 150,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // Use PostgreSQL UPSERT syntax
      await db.execute(sql`
        INSERT INTO auto_response_configs 
        (id, account_id, is_enabled, prompt, temperature, response_style, response_delay, max_tokens, created_at, updated_at)
        VALUES (${configId}, ${accountId}, ${newConfig.isEnabled}, ${newConfig.prompt}, ${newConfig.temperature}, 
                ${newConfig.responseStyle}, ${newConfig.responseDelay}, ${newConfig.maxTokens}, ${now}, ${now})
        ON CONFLICT (account_id) 
        DO UPDATE SET 
          is_enabled = EXCLUDED.is_enabled,
          prompt = EXCLUDED.prompt,
          temperature = EXCLUDED.temperature,
          response_style = EXCLUDED.response_style,
          response_delay = EXCLUDED.response_delay,
          max_tokens = EXCLUDED.max_tokens,
          updated_at = EXCLUDED.updated_at
      `);

      this.configs.set(accountId, newConfig);
      console.log(`💾 Configuración guardada para cuenta ${accountId}`);
      
      return newConfig;
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  async activateAutoResponse(accountId: number): Promise<boolean> {
    try {
      const config = this.configs.get(accountId);
      if (!config) {
        // Create default config
        await this.createOrUpdateConfig(accountId, { isEnabled: true });
      } else {
        await this.createOrUpdateConfig(accountId, { ...config, isEnabled: true });
      }
      
      console.log(`🟢 Respuestas automáticas activadas para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error activating auto response for account ${accountId}:`, error);
      return false;
    }
  }

  async deactivateAutoResponse(accountId: number): Promise<boolean> {
    try {
      const config = this.configs.get(accountId);
      if (config) {
        await this.createOrUpdateConfig(accountId, { ...config, isEnabled: false });
      }
      
      console.log(`🔴 Respuestas automáticas desactivadas para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error deactivating auto response for account ${accountId}:`, error);
      return false;
    }
  }

  addIncomingMessage(chatId: string, accountId: number, message: string): void {
    const config = this.configs.get(accountId);
    if (!config || !config.isEnabled) {
      return;
    }

    const pendingMessage: PendingMessage = {
      chatId,
      accountId,
      message: message.trim(),
      timestamp: Date.now(),
      processed: false
    };

    this.pendingMessages.push(pendingMessage);
    console.log(`📨 Mensaje agregado a cola de respuestas: ${chatId} - ${message.substring(0, 50)}...`);
  }

  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      await this.processMessages();
    }, 2000); // Check every 2 seconds

    this.isRunning = true;
    console.log('🔄 Procesador de mensajes iniciado');
  }

  private async processMessages(): Promise<void> {
    if (this.pendingMessages.length === 0) return;

    const messagesToProcess = this.pendingMessages.filter(msg => !msg.processed);
    
    for (const pendingMessage of messagesToProcess) {
      try {
        await this.processMessage(pendingMessage);
        pendingMessage.processed = true;
      } catch (error) {
        console.error('Error processing message:', error);
        pendingMessage.processed = true; // Mark as processed to avoid retry loop
      }
    }

    // Clean up processed messages
    this.pendingMessages = this.pendingMessages.filter(msg => !msg.processed);
  }

  private async processMessage(pendingMessage: PendingMessage): Promise<void> {
    const config = this.configs.get(pendingMessage.accountId);
    if (!config || !config.isEnabled) return;

    // Wait for response delay
    const delayMs = config.responseDelay * 1000;
    const timeSinceMessage = Date.now() - pendingMessage.timestamp;
    
    if (timeSinceMessage < delayMs) {
      return; // Not time yet
    }

    console.log(`🤖 Generando respuesta para: ${pendingMessage.chatId}`);

    try {
      const response = await this.generateResponse(pendingMessage.message, config);
      
      if (response) {
        await this.sendAutoResponse(pendingMessage.chatId, pendingMessage.accountId, response);
      }
    } catch (error) {
      console.error('Error generating/sending response:', error);
    }
  }

  private async generateResponse(message: string, config: AutoResponseConfig): Promise<string | null> {
    try {
      const systemPrompt = this.buildSystemPrompt(config);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: "json_object" }
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) return null;

      const parsedResponse = JSON.parse(responseContent);
      return parsedResponse.response || null;
    } catch (error) {
      console.error('Error generating OpenAI response:', error);
      return null;
    }
  }

  private buildSystemPrompt(config: AutoResponseConfig): string {
    const stylePrompts = {
      professional: 'Mantén un tono profesional y formal.',
      friendly: 'Usa un tono amigable y cálido.',
      casual: 'Responde de manera casual y relajada.',
      humorous: 'Incluye un toque de humor apropiado en tus respuestas.'
    };

    return `${config.prompt} ${stylePrompts[config.responseStyle]} 
    Responde ÚNICAMENTE en formato JSON con esta estructura: {"response": "tu respuesta aquí"}. 
    Mantén las respuestas concisas y útiles. No incluyas información que no sea necesaria.`;
  }

  private async sendAutoResponse(chatId: string, accountId: number, response: string): Promise<void> {
    try {
      // Send message using direct HTTP request to avoid Vite interception
      const payload = {
        chatId,
        message: response,
        accountId
      };

      // Use Node.js fetch to bypass Vite
      const fetch = (await import('node-fetch')).default;
      const serverResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AutoResponseSystem/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (serverResponse.ok) {
        console.log(`✅ Respuesta automática enviada a ${chatId}: ${response.substring(0, 50)}...`);
      } else {
        console.error(`❌ Error enviando respuesta automática: ${serverResponse.status}`);
      }
    } catch (error) {
      console.error('Error sending auto response:', error);
    }
  }

  getConfig(accountId: number): AutoResponseConfig | undefined {
    return this.configs.get(accountId);
  }

  getAllConfigs(): AutoResponseConfig[] {
    return Array.from(this.configs.values());
  }

  isEnabled(accountId: number): boolean {
    const config = this.configs.get(accountId);
    return config ? config.isEnabled : false;
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Sistema de respuestas automáticas detenido');
  }
}

export const autoResponseSystem = new AutoResponseSystem();
export type { AutoResponseConfig, PendingMessage };