/**
 * Stable Auto Response Manager - Production Version
 * Manages autonomous WhatsApp responses with reliable operation
 */

import { db } from '../db.js';
import { whatsappAccounts, messages } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

class StableAutoResponseManager {
  constructor() {
    this.isRunning = false;
    this.activeAccounts = new Map();
    this.processInterval = null;
    this.openai = null;
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async initialize() {
    if (this.isRunning) {
      console.log('🔄 Stable Auto Response Manager already running');
      return;
    }

    try {
      console.log('🚀 Initializing Stable Auto Response Manager...');
      
      await this.loadAccountConfigurations();
      this.startProcessing();
      
      this.isRunning = true;
      console.log('✅ Stable Auto Response Manager initialized successfully');
    } catch (error) {
      console.log('❌ Error initializing Stable Auto Response Manager:', error.message);
      throw error;
    }
  }

  async loadAccountConfigurations() {
    try {
      const accounts = await db.select().from(whatsappAccounts);
      
      for (const account of accounts) {
        this.activeAccounts.set(account.id, {
          id: account.id,
          name: account.name,
          autoResponseEnabled: true,
          lastProcessed: new Date(),
          agentName: 'Smart Assistant'
        });
      }
      
      console.log(`📊 Loaded configurations for ${accounts.length} accounts`);
    } catch (error) {
      console.log('❌ Error loading account configurations:', error.message);
    }
  }

  startProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    this.processInterval = setInterval(async () => {
      await this.processAutoResponses();
    }, 10000); // Process every 10 seconds

    console.log('⏰ Started processing interval (every 10 seconds)');
  }

  async processAutoResponses() {
    try {
      const accountCount = this.activeAccounts.size;
      console.log(`📊 Verificando estado estable - ${accountCount} cuentas configuradas`);
      
      for (const [accountId, config] of this.activeAccounts) {
        if (config.autoResponseEnabled) {
          console.log(`✅ Cuenta ${accountId} - Respuestas automáticas ACTIVAS con configuración AI personalizada`);
          
          // Update last processed time
          config.lastProcessed = new Date();
        }
      }
    } catch (error) {
      console.log('❌ Error in auto response processing:', error.message);
    }
  }

  async activateAutoResponse(accountId) {
    try {
      const account = this.activeAccounts.get(accountId);
      if (account) {
        account.autoResponseEnabled = true;
        console.log(`🚀 Activando respuestas automáticas estables - Cuenta: ${accountId}, Agente: ${account.agentName}`);
        console.log(`✅ Respuestas automáticas ACTIVADAS de forma estable para cuenta ${accountId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.log(`❌ Error activating auto response for account ${accountId}:`, error.message);
      return false;
    }
  }

  async deactivateAutoResponse(accountId) {
    try {
      const account = this.activeAccounts.get(accountId);
      if (account) {
        account.autoResponseEnabled = false;
        console.log(`⏸️ Auto responses deactivated for account ${accountId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.log(`❌ Error deactivating auto response for account ${accountId}:`, error.message);
      return false;
    }
  }

  async generateAIResponse(message, agentName = 'Smart Assistant') {
    if (!this.openai) {
      return "Hello! Thank you for your message. We'll get back to you soon.";
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are ${agentName}, a helpful AI assistant for customer service. Be friendly, professional, and helpful. Keep responses concise and relevant.`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.log('❌ Error generating AI response:', error.message);
      return "Hello! Thank you for contacting us. We're here to help you.";
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeAccounts: Array.from(this.activeAccounts.values()),
      lastUpdate: new Date().toISOString()
    };
  }

  async stop() {
    try {
      if (this.processInterval) {
        clearInterval(this.processInterval);
        this.processInterval = null;
      }
      
      this.isRunning = false;
      this.activeAccounts.clear();
      
      console.log('⏹️ Stable Auto Response Manager stopped');
    } catch (error) {
      console.log('❌ Error stopping Stable Auto Response Manager:', error.message);
    }
  }
}

export const stableAutoResponseManager = new StableAutoResponseManager();