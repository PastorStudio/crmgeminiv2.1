/**
 * ChatGPT Plus Web Service
 * Direct integration with ChatGPT Plus web interface using automation
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export class ChatGPTPlusWebService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private sessionCookies: any[] = [];

  constructor() {
    this.initialize();
  }

  /**
   * Initialize ChatGPT Plus web session
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Iniciando ChatGPT Plus Web Service...');
      
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

      this.page = await this.browser.newPage();
      
      // Set user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to ChatGPT
      await this.page.goto('https://chat.openai.com/', { waitUntil: 'networkidle2' });
      
      console.log('✅ ChatGPT Plus Web Service inicializado');
      this.isInitialized = true;
      
    } catch (error) {
      console.error('❌ Error inicializando ChatGPT Plus Web Service:', error);
      throw error;
    }
  }

  /**
   * Login to ChatGPT Plus (requires manual session setup or credentials)
   */
  async loginWithCredentials(email: string, password: string): Promise<boolean> {
    try {
      if (!this.page) {
        await this.initialize();
      }

      console.log('🔐 Intentando login a ChatGPT Plus...');
      
      // Wait for login button and click it
      await this.page.waitForSelector('[data-testid="login-button"]', { timeout: 10000 });
      await this.page.click('[data-testid="login-button"]');
      
      // Fill email
      await this.page.waitForSelector('#username', { timeout: 10000 });
      await this.page.type('#username', email);
      
      // Click continue
      await this.page.click('button[type="submit"]');
      
      // Fill password
      await this.page.waitForSelector('#password', { timeout: 10000 });
      await this.page.type('#password', password);
      
      // Submit login
      await this.page.click('button[type="submit"]');
      
      // Wait for successful login
      await this.page.waitForSelector('[data-testid="chat-input"]', { timeout: 30000 });
      
      // Save session cookies
      this.sessionCookies = await this.page.cookies();
      
      console.log('✅ Login exitoso a ChatGPT Plus');
      return true;
      
    } catch (error) {
      console.error('❌ Error en login a ChatGPT Plus:', error);
      return false;
    }
  }

  /**
   * Set session cookies for authenticated access
   */
  async setSessionCookies(cookies: any[]): Promise<void> {
    if (!this.page) {
      await this.initialize();
    }
    
    try {
      await this.page.setCookie(...cookies);
      this.sessionCookies = cookies;
      console.log('✅ Session cookies configuradas para ChatGPT Plus');
    } catch (error) {
      console.error('❌ Error configurando session cookies:', error);
    }
  }

  /**
   * Generate response using ChatGPT Plus web interface
   */
  async generateResponse(message: string, agentName: string = 'Asistente AI'): Promise<string> {
    try {
      if (!this.page || !this.isInitialized) {
        await this.initialize();
      }

      console.log(`🤖 Generando respuesta con ChatGPT Plus para: ${agentName}`);
      
      // Navigate to ChatGPT if not already there
      if (!this.page!.url().includes('chat.openai.com')) {
        await this.page!.goto('https://chat.openai.com/', { waitUntil: 'networkidle2' });
      }

      // Check if we need to start a new conversation
      try {
        await this.page!.waitForSelector('[data-testid="chat-input"]', { timeout: 5000 });
      } catch {
        // Click "New chat" if needed
        const newChatButton = await this.page!.$('[data-testid="new-chat-button"]');
        if (newChatButton) {
          await newChatButton.click();
          await this.page!.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
        }
      }

      // Type the message
      const chatInput = await this.page!.$('[data-testid="chat-input"]');
      if (!chatInput) {
        throw new Error('Chat input not found');
      }

      // Clear input and type message
      await chatInput.click({ clickCount: 3 });
      await chatInput.type(`Como ${agentName}, responde de manera profesional y amigable: ${message}`);
      
      // Send message
      await this.page!.keyboard.press('Enter');
      
      // Wait for response
      await this.page!.waitForFunction(
        () => {
          const messages = document.querySelectorAll('[data-testid^="conversation-turn-"]');
          return messages.length >= 2; // User message + AI response
        },
        { timeout: 30000 }
      );

      // Get the latest AI response
      await this.page!.waitForTimeout(2000); // Wait for response to complete
      
      const response = await this.page!.evaluate(() => {
        const messages = document.querySelectorAll('[data-testid^="conversation-turn-"]');
        const lastMessage = messages[messages.length - 1];
        return lastMessage?.textContent || '';
      });

      if (response && response.trim().length > 0) {
        console.log(`✅ Respuesta generada exitosamente con ChatGPT Plus: ${response.substring(0, 100)}...`);
        return response.trim();
      } else {
        throw new Error('No se pudo obtener respuesta de ChatGPT Plus');
      }

    } catch (error) {
      console.error('❌ Error generando respuesta con ChatGPT Plus:', error);
      
      // Fallback response
      const fallbackResponses = [
        'Gracias por tu mensaje. Un representante se pondrá en contacto contigo pronto.',
        'Hemos recibido tu consulta y la estamos procesando. Te responderemos en breve.',
        'Apreciamos tu contacto. Nuestro equipo revisará tu mensaje y te responderá.',
        'Tu solicitud es importante para nosotros. Te responderemos en el menor tiempo posible.',
        'Estamos aquí para ayudarte. ¿En qué más podemos asistirte?'
      ];
      
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      console.log('🔄 Usando respuesta de emergencia para ChatGPT Plus');
      return randomResponse;
    }
  }

  /**
   * Check if service is available and authenticated
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.page || !this.isInitialized) {
        return false;
      }

      // Check if we can access chat input (indicates authenticated session)
      await this.page.goto('https://chat.openai.com/', { waitUntil: 'networkidle2' });
      
      try {
        await this.page.waitForSelector('[data-testid="chat-input"]', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error verificando disponibilidad de ChatGPT Plus:', error);
      return false;
    }
  }

  /**
   * Close browser and cleanup
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        console.log('✅ ChatGPT Plus Web Service cerrado correctamente');
      }
    } catch (error) {
      console.error('❌ Error cerrando ChatGPT Plus Web Service:', error);
    }
  }

  /**
   * Get session cookies for external storage
   */
  getSessionCookies(): any[] {
    return this.sessionCookies;
  }
}

// Singleton instance
export const chatgptPlusWebService = new ChatGPTPlusWebService();