/**
 * Conector directo a ChatGPT usando Puppeteer
 * Permite interactuar con modelos personalizados sin necesidad de API key
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export class ChatGPTConnector {
  private browser: Browser | null = null;
  private pages: Map<string, Page> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Inicializando conector ChatGPT...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      this.isInitialized = true;
      console.log('✅ Conector ChatGPT inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando ChatGPT:', error);
      throw error;
    }
  }

  async connectToAgent(agentUrl: string): Promise<string> {
    if (!this.browser) {
      await this.initialize();
    }

    try {
      const page = await this.browser!.newPage();
      
      // Configurar user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log(`🔗 Conectando a agente: ${agentUrl}`);
      await page.goto(agentUrl, { waitUntil: 'networkidle2' });
      
      // Extraer ID del agente desde la URL
      const agentId = this.extractAgentIdFromUrl(agentUrl);
      this.pages.set(agentId, page);
      
      console.log(`✅ Conectado a agente ${agentId}`);
      return agentId;
    } catch (error) {
      console.error('❌ Error conectando a agente:', error);
      throw error;
    }
  }

  async sendMessage(agentId: string, message: string): Promise<string> {
    const page = this.pages.get(agentId);
    if (!page) {
      throw new Error(`Agente ${agentId} no encontrado`);
    }

    try {
      console.log(`💬 Enviando mensaje a ${agentId}: "${message}"`);

      // Buscar el campo de texto
      await page.waitForSelector('textarea[placeholder*="Message"], textarea[data-id*="root"], #prompt-textarea', { timeout: 5000 });
      
      // Escribir el mensaje
      const textArea = await page.$('textarea[placeholder*="Message"], textarea[data-id*="root"], #prompt-textarea');
      if (textArea) {
        await textArea.click();
        await textArea.type(message);
        
        // Enviar mensaje (Enter o botón)
        await page.keyboard.press('Enter');
        
        // Esperar respuesta
        await this.waitForResponse(page);
        
        // Obtener la última respuesta
        const response = await this.getLatestResponse(page);
        console.log(`✅ Respuesta recibida de ${agentId}: "${response}"`);
        
        return response;
      } else {
        throw new Error('Campo de texto no encontrado');
      }
    } catch (error) {
      console.error(`❌ Error enviando mensaje a ${agentId}:`, error);
      throw error;
    }
  }

  private async waitForResponse(page: Page): Promise<void> {
    try {
      // Esperar a que aparezca una nueva respuesta
      await page.waitForFunction(() => {
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
        return messages.length > 0;
      }, { timeout: 30000 });
      
      // Esperar un poco más para que termine de escribir
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('⏰ Timeout esperando respuesta, continuando...');
    }
  }

  private async getLatestResponse(page: Page): Promise<string> {
    try {
      const response = await page.evaluate(() => {
        // Buscar el último mensaje del asistente
        const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (assistantMessages.length > 0) {
          const lastMessage = assistantMessages[assistantMessages.length - 1];
          return lastMessage.textContent?.trim() || 'Respuesta no disponible';
        }
        
        // Fallback: buscar por otros selectores
        const messages = document.querySelectorAll('.markdown, .message-content, .prose');
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          return lastMessage.textContent?.trim() || 'Respuesta no disponible';
        }
        
        return 'No se pudo obtener respuesta';
      });
      
      return response;
    } catch (error) {
      console.error('❌ Error obteniendo respuesta:', error);
      return 'Error obteniendo respuesta del agente';
    }
  }

  private extractAgentIdFromUrl(url: string): string {
    try {
      // Extraer ID del modelo desde URL de ChatGPT
      const match = url.match(/g-([a-zA-Z0-9]+)/);
      return match ? match[1] : 'unknown-agent';
    } catch (error) {
      return 'unknown-agent';
    }
  }

  async closeAgent(agentId: string): Promise<void> {
    const page = this.pages.get(agentId);
    if (page) {
      await page.close();
      this.pages.delete(agentId);
      console.log(`🔌 Desconectado agente ${agentId}`);
    }
  }

  async closeAll(): Promise<void> {
    try {
      for (const agentId of this.pages.keys()) {
        const page = this.pages.get(agentId);
        if (page) await page.close();
      }
      this.pages.clear();
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.isInitialized = false;
      console.log('🔌 Conector ChatGPT cerrado completamente');
    } catch (error) {
      console.error('❌ Error cerrando conector:', error);
    }
  }

  isAgentConnected(agentId: string): boolean {
    return this.pages.has(agentId);
  }

  getConnectedAgents(): string[] {
    return Array.from(this.pages.keys());
  }
}

// Instancia singleton
export const chatGPTConnector = new ChatGPTConnector();