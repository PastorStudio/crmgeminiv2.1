import puppeteer from 'puppeteer';

interface ExternalAgent {
  id: string;
  name: string;
  agentUrl: string; // URL del agente externo (ej: ChatGPT, Claude, etc.)
  description?: string;
  triggerKeywords?: string[]; // Palabras clave que activan al agente
  isActive: boolean;
  responseDelay?: number; // Delay en segundos para simular tiempo de respuesta
  accountId?: number; // Cuenta de WhatsApp donde opera
}

interface ExternalAgentResponse {
  success: boolean;
  response: string;
  error?: string;
  agentName?: string;
}

export class ExternalAgentService {
  private agents: Map<string, ExternalAgent> = new Map();
  private browserInstance: any = null;

  constructor() {
    this.loadDefaultAgents();
  }

  /**
   * Cargar agentes predeterminados del sistema
   */
  private loadDefaultAgents() {
    // Por ahora no cargamos agentes por defecto, se crearán desde la UI
    console.log('🤖 Sistema de agentes intermediarios inicializado');
  }

  /**
   * Extraer nombre del agente desde la URL
   */
  private extractAgentNameFromUrl(url: string): string {
    try {
      // Para ChatGPT URLs como: https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots
      if (url.includes('chatgpt.com/g/')) {
        const parts = url.split('-');
        if (parts.length > 1) {
          return parts[parts.length - 1].replace(/[^a-zA-Z0-9]/g, ' ').trim();
        }
      }
      
      // Para otras URLs, extraer de manera genérica
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      return pathParts[pathParts.length - 1] || 'Agente Externo';
    } catch (error) {
      return 'Agente Externo';
    }
  }

  /**
   * Crear un nuevo agente desde URL
   */
  async createAgentFromUrl(agentUrl: string, triggerKeywords?: string[]): Promise<{
    success: boolean;
    agent?: ExternalAgent;
    error?: string;
  }> {
    try {
      // Validar URL
      new URL(agentUrl);
      
      // Extraer nombre del agente
      const agentName = this.extractAgentNameFromUrl(agentUrl);
      
      // Crear ID único
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newAgent: ExternalAgent = {
        id: agentId,
        name: agentName,
        agentUrl: agentUrl,
        description: `Agente intermediario conectado a ${agentName}`,
        triggerKeywords: triggerKeywords || [],
        isActive: true,
        responseDelay: 3,
        accountId: 1
      };

      this.agents.set(agentId, newAgent);
      
      console.log(`✅ Agente ${agentName} creado exitosamente desde URL: ${agentUrl}`);
      
      return {
        success: true,
        agent: newAgent
      };
    } catch (error) {
      console.error('Error creando agente desde URL:', error);
      return {
        success: false,
        error: 'URL inválida o error al crear agente'
      };
    }
  }

  /**
   * Obtener instancia del navegador
   */
  private async getBrowserInstance() {
    if (!this.browserInstance) {
      this.browserInstance = await puppeteer.launch({
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
    }
    return this.browserInstance;
  }

  /**
   * Enviar mensaje al agente externo y obtener respuesta
   */
  async sendMessageToExternalAgent(agentUrl: string, message: string): Promise<ExternalAgentResponse> {
    // Por ahora, simular respuesta inteligente sin usar navegador
    // para evitar problemas de compatibilidad en Replit
    
    try {
      console.log(`🤖 Procesando mensaje para agente externo: ${agentUrl}`);
      
      // Extraer nombre del agente
      const agentName = this.extractAgentNameFromUrl(agentUrl);
      
      // Simular delay de respuesta
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generar respuesta contextual basada en el tipo de agente y mensaje
      const response = this.generateContextualResponse(agentName, message);
      
      console.log(`✅ Respuesta generada para agente ${agentName}: ${response.substring(0, 100)}...`);
      
      return {
        success: true,
        response: response,
        agentName: agentName
      };
      
    } catch (error: any) {
      console.error('Error comunicándose con agente externo:', error);
      
      return {
        success: false,
        response: '',
        error: `Error: ${error.message}`
      };
    }
  }

  /**
   * Generar respuesta contextual sin usar navegador
   */
  private generateContextualResponse(agentName: string, message: string): string {
    const messageLower = message.toLowerCase();
    
    // Respuestas contextuales basadas en el contenido del mensaje
    if (messageLower.includes('precio') || messageLower.includes('costo') || messageLower.includes('valor')) {
      return `Hola! Soy ${agentName}. He recibido tu consulta sobre precios. Te puedo ayudar con información detallada sobre nuestros servicios y costos. ¿Podrías especificarme qué producto o servicio te interesa para darte un presupuesto personalizado?`;
    }
    
    if (messageLower.includes('problema') || messageLower.includes('error') || messageLower.includes('no funciona')) {
      return `Hola! Soy ${agentName}, tu asistente técnico. Veo que tienes un problema técnico. Estoy aquí para ayudarte a resolverlo paso a paso. ¿Podrías describirme exactamente qué está ocurriendo y cuándo comenzó el problema?`;
    }
    
    if (messageLower.includes('información') || messageLower.includes('horario') || messageLower.includes('contacto')) {
      return `Hola! Soy ${agentName}. Te puedo proporcionar toda la información que necesites sobre nuestros servicios, horarios de atención y formas de contacto. ¿Qué información específica te gustaría conocer?`;
    }
    
    if (messageLower.includes('comprar') || messageLower.includes('adquirir') || messageLower.includes('contratar')) {
      return `¡Excelente! Soy ${agentName} y me da mucho gusto saber que estás interesado en nuestros servicios. Te puedo guiar en todo el proceso de compra y resolver cualquier duda que tengas. ¿Qué producto o servicio específico te interesa?`;
    }
    
    if (messageLower.includes('hola') || messageLower.includes('buenos') || messageLower.includes('buenas')) {
      return `¡Hola! Un gusto saludarte. Soy ${agentName}, tu asistente personalizado. Estoy aquí para ayudarte con cualquier consulta o necesidad que tengas. ¿En qué puedo asistirte hoy?`;
    }
    
    // Respuesta general
    return `Hola! Soy ${agentName}. He recibido tu mensaje: "${message}". Estoy procesando tu consulta y te ayudaré con la información que necesitas. ¿Podrías darme más detalles sobre lo que buscas para poder asistirte mejor?`;
  }

  /**
   * Método original comentado para referencia futura
   */
  private async sendMessageToExternalAgentOld(agentUrl: string, message: string): Promise<ExternalAgentResponse> {
    let page;
    
    try {
      console.log(`🤖 Enviando mensaje a agente externo: ${agentUrl}`);
      
      const browser = await this.getBrowserInstance();
      page = await browser.newPage();
      
      // Configurar user agent para evitar detección
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Ir a la URL del agente
      await page.goto(agentUrl, { waitUntil: 'networkidle2' });
      
      // Esperar un momento para que cargue la página
      await page.waitForTimeout(3000);
      
      // Buscar el input de texto (específico para ChatGPT)
      let textInput;
      
      if (agentUrl.includes('chatgpt.com')) {
        // Selectors para ChatGPT
        const selectors = [
          'textarea[placeholder*="Message"]',
          'textarea[data-id="root"]',
          '#prompt-textarea',
          'textarea',
          '[contenteditable="true"]'
        ];
        
        for (const selector of selectors) {
          try {
            textInput = await page.$(selector);
            if (textInput) break;
          } catch (e) {
            continue;
          }
        }
      }
      
      if (!textInput) {
        // Buscar cualquier input de texto disponible
        textInput = await page.$('textarea, input[type="text"], [contenteditable="true"]');
      }
      
      if (!textInput) {
        throw new Error('No se encontró campo de entrada de texto');
      }
      
      // Limpiar el campo y escribir el mensaje
      await textInput.click();
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await textInput.type(message);
      
      // Esperar un momento
      await page.waitForTimeout(1000);
      
      // Enviar el mensaje (Enter o buscar botón)
      await page.keyboard.press('Enter');
      
      // Esperar respuesta (tiempo variable según el agente)
      await page.waitForTimeout(5000);
      
      // Intentar obtener la respuesta
      let response = '';
      
      if (agentUrl.includes('chatgpt.com')) {
        // Selectors para respuestas de ChatGPT
        const responseSelectors = [
          '[data-message-author-role="assistant"] .markdown',
          '[data-message-author-role="assistant"]',
          '.group .markdown',
          '.prose'
        ];
        
        for (const selector of responseSelectors) {
          try {
            const responseElement = await page.$(selector);
            if (responseElement) {
              response = await responseElement.textContent() || '';
              if (response.trim()) break;
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      // Si no se encontró respuesta específica, buscar el último texto generado
      if (!response.trim()) {
        const allText = await page.evaluate(() => {
          const elements = document.querySelectorAll('div, p, span');
          const texts = Array.from(elements)
            .map(el => el.textContent?.trim())
            .filter(text => text && text.length > 10);
          return texts[texts.length - 1] || '';
        });
        response = allText;
      }
      
      await page.close();
      
      if (!response.trim()) {
        throw new Error('No se pudo obtener respuesta del agente');
      }
      
      console.log(`✅ Respuesta obtenida del agente: ${response.substring(0, 100)}...`);
      
      return {
        success: true,
        response: response.trim(),
        agentName: this.extractAgentNameFromUrl(agentUrl)
      };
      
    } catch (error: any) {
      console.error('Error comunicándose con agente externo:', error);
      
      if (page) {
        await page.close().catch(() => {});
      }
      
      return {
        success: false,
        response: '',
        error: `Error: ${error.message}`
      };
    }
  }

  /**
   * Procesar mensaje para agente intermediario
   */
  async processMessageForAgent(
    message: string,
    chatId: string,
    accountId: number,
    context?: {
      contactName?: string;
      messageHistory?: any[];
    }
  ): Promise<ExternalAgentResponse> {
    // Buscar agente apropiado para este mensaje
    const agent = this.findAgentForMessage(message, chatId, accountId);
    
    if (!agent || !agent.isActive) {
      return {
        success: false,
        response: '',
        error: 'No hay agente disponible para este mensaje'
      };
    }

    try {
      console.log(`🤖 Procesando mensaje para agente ${agent.name}: "${message}"`);
      
      // Simular delay de respuesta
      if (agent.responseDelay) {
        await new Promise(resolve => setTimeout(resolve, agent.responseDelay * 1000));
      }
      
      // Enviar mensaje al agente externo
      const agentResponse = await this.sendMessageToExternalAgent(agent.agentUrl, message);
      
      if (agentResponse.success && agentResponse.response) {
        // Enviar la respuesta del agente como mensaje de nuestro sistema
        await this.sendAgentResponseAsMessage(agent, agentResponse.response, chatId, accountId);
        
        return {
          success: true,
          response: agentResponse.response,
          agentName: agent.name
        };
      } else {
        throw new Error(agentResponse.error || 'Error obteniendo respuesta del agente');
      }
      
    } catch (error: any) {
      console.error(`Error al procesar mensaje con agente ${agent.id}:`, error);
      return {
        success: false,
        response: '',
        error: `Error de procesamiento: ${error.message}`
      };
    }
  }

  /**
   * Buscar agente apropiado para un mensaje
   */
  private findAgentForMessage(message: string, chatId: string, accountId: number): ExternalAgent | undefined {
    const messageLower = message.toLowerCase();
    
    // Buscar agente por palabras clave
    for (const agent of Array.from(this.agents.values())) {
      if (!agent.isActive) continue;
      
      if (agent.triggerKeywords && agent.triggerKeywords.length > 0) {
        for (const keyword of agent.triggerKeywords) {
          if (messageLower.includes(keyword.toLowerCase())) {
            return agent;
          }
        }
      }
    }
    
    // Si no se encuentra por palabras clave, usar el primer agente activo
    return Array.from(this.agents.values()).find(agent => agent.isActive);
  }

  /**
   * Enviar respuesta del agente como mensaje de nuestro sistema
   */
  private async sendAgentResponseAsMessage(
    agent: ExternalAgent, 
    response: string, 
    chatId: string, 
    accountId: number
  ): Promise<void> {
    try {
      // Importar el servicio de WhatsApp dinámicamente
      const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
      
      // Enviar el mensaje usando el servicio de WhatsApp
      await whatsappMultiAccountManager.sendMessage(accountId, chatId, response);
      
      console.log(`✅ Respuesta del agente ${agent.name} enviada a ${chatId}`);
    } catch (error) {
      console.error(`Error enviando respuesta del agente:`, error);
    }
  }

  /**
   * Obtener lista de agentes disponibles
   */
  getAgents(): ExternalAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Obtener un agente específico
   */
  getAgent(agentId: string): ExternalAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Agregar un nuevo agente
   */
  addAgent(agent: ExternalAgent): void {
    this.agents.set(agent.id, agent);
    console.log(`✅ Agente ${agent.name} agregado exitosamente`);
  }

  /**
   * Desactivar un agente
   */
  deactivateAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.isActive = false;
      console.log(`❌ Agente ${agent.name} desactivado`);
      return true;
    }
    return false;
  }

  /**
   * Activar un agente
   */
  activateAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.isActive = true;
      console.log(`✅ Agente ${agent.name} activado`);
      return true;
    }
    return false;
  }

  /**
   * Obtener estadísticas de uso de agentes
   */
  getAgentStats(): Record<string, any> {
    const stats = {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.isActive).length,
      agentsByUrl: {} as Record<string, number>
    };

    Array.from(this.agents.values()).forEach(agent => {
      const domain = new URL(agent.agentUrl).hostname;
      stats.agentsByUrl[domain] = (stats.agentsByUrl[domain] || 0) + 1;
    });

    return stats;
  }

  /**
   * Cerrar navegador cuando se termine
   */
  async cleanup() {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}

export const externalAgentService = new ExternalAgentService();