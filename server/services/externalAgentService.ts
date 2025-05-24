import OpenAI from 'openai';

interface ExternalAgent {
  id: string;
  name: string;
  description: string;
  chatId: string; // El chat ID donde este agente "vive"
  accountId: number; // La cuenta de WhatsApp donde está el agente
  triggerKeywords?: string[]; // Palabras clave que activan al agente
  isActive: boolean;
  responseDelay?: number; // Delay en segundos para simular tiempo de respuesta
  specialization?: string; // Especialización del agente
}

interface ExternalAgentResponse {
  success: boolean;
  response: string;
  error?: string;
  usage?: {
    tokens?: number;
    cost?: number;
  };
}

export class ExternalAgentService {
  private agents: Map<string, ExternalAgent> = new Map();
  private openai: OpenAI;

  constructor() {
    // Inicializar OpenAI para generar respuestas inteligentes
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    
    // Cargar agentes desde configuración o base de datos
    this.loadDefaultAgents();
  }

  /**
   * Cargar agentes predeterminados del sistema
   */
  private loadDefaultAgents() {
    // Agente de ejemplo - Asistente de Ventas
    this.addAgent({
      id: 'sales-assistant',
      name: 'Asistente de Ventas',
      description: 'Especialista en ventas y consultas comerciales',
      chatId: 'ventas@empresa.com',
      accountId: 1,
      triggerKeywords: ['precio', 'comprar', 'venta', 'cotización', 'producto', 'costo', 'oferta'],
      specialization: 'ventas',
      isActive: true,
      responseDelay: 2
    });

    // Agente de ejemplo - Soporte Técnico
    this.addAgent({
      id: 'support-tech',
      name: 'Soporte Técnico',
      description: 'Especialista en problemas técnicos y configuración',
      chatId: 'soporte@empresa.com',
      accountId: 1,
      triggerKeywords: ['problema', 'error', 'no funciona', 'ayuda', 'configurar', 'bug', 'falla'],
      specialization: 'soporte',
      isActive: true,
      responseDelay: 3
    });

    // Agente de ejemplo - Información General
    this.addAgent({
      id: 'info-general',
      name: 'Información General',
      description: 'Responde preguntas generales sobre la empresa y servicios',
      chatId: 'info@empresa.com',
      accountId: 1,
      triggerKeywords: ['información', 'horario', 'ubicación', 'contacto', 'empresa', 'servicios'],
      specialization: 'informacion',
      isActive: true,
      responseDelay: 1
    });

    console.log('🤖 Agentes intermediarios cargados exitosamente');
  }

  /**
   * Agregar un nuevo agente externo
   */
  addAgent(agent: ExternalAgent): void {
    this.agents.set(agent.id, agent);
    console.log(`✅ Agente ${agent.name} agregado exitosamente`);
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
   * Buscar agente apropiado para un mensaje
   */
  private findAgentForMessage(message: string, chatId: string, accountId: number): ExternalAgent | undefined {
    const messageLower = message.toLowerCase();
    
    // Buscar agente por palabras clave
    for (const agent of this.agents.values()) {
      if (!agent.isActive) continue;
      
      if (agent.triggerKeywords) {
        for (const keyword of agent.triggerKeywords) {
          if (messageLower.includes(keyword.toLowerCase())) {
            return agent;
          }
        }
      }
    }
    
    // Si no se encuentra por palabras clave, usar agente de información general
    return Array.from(this.agents.values()).find(agent => 
      agent.specialization === 'informacion' && agent.isActive
    );
  }

  /**
   * Generar respuesta inteligente del agente
   */
  private async generateAgentResponse(
    agent: ExternalAgent, 
    message: string, 
    context?: {
      contactName?: string;
      messageHistory?: any[];
    }
  ): Promise<string> {
    try {
      const systemPrompt = this.getSystemPromptForAgent(agent);
      const userContext = context?.contactName ? `El usuario se llama ${context.contactName}. ` : '';
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `${userContext}Mensaje: ${message}`
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0].message.content || "Lo siento, no pude procesar tu mensaje en este momento.";
    } catch (error) {
      console.error('Error generando respuesta del agente:', error);
      return this.getFallbackResponse(agent, message);
    }
  }

  /**
   * Obtener prompt del sistema para cada tipo de agente
   */
  private getSystemPromptForAgent(agent: ExternalAgent): string {
    switch (agent.specialization) {
      case 'ventas':
        return `Eres un asistente de ventas profesional y amigable. Tu trabajo es ayudar a los clientes con consultas sobre productos, precios y servicios. Mantén un tono profesional pero cálido. Siempre intenta convertir la conversación hacia una venta o una cita. Responde en español de manera concisa y útil.`;
      
      case 'soporte':
        return `Eres un especialista en soporte técnico. Tu trabajo es ayudar a resolver problemas técnicos, errores de configuración y dudas sobre el funcionamiento de productos o servicios. Sé paciente, claro y paso a paso en tus explicaciones. Responde en español de manera técnica pero comprensible.`;
      
      case 'informacion':
        return `Eres un asistente de información general de la empresa. Proporciona información sobre horarios, ubicación, servicios generales y datos básicos de la empresa. Mantén un tono profesional y servicial. Responde en español de manera clara y directa.`;
      
      default:
        return `Eres un asistente virtual útil y profesional. Responde de manera clara, concisa y útil. Mantén un tono amigable y profesional. Responde en español.`;
    }
  }

  /**
   * Respuesta de fallback en caso de error
   */
  private getFallbackResponse(agent: ExternalAgent, message: string): string {
    switch (agent.specialization) {
      case 'ventas':
        return "Gracias por tu consulta sobre nuestros productos. Un representante de ventas se pondrá en contacto contigo pronto para brindarte información detallada.";
      
      case 'soporte':
        return "He recibido tu consulta técnica. Nuestro equipo de soporte técnico revisará tu caso y te proporcionará una solución en breve.";
      
      case 'informacion':
        return "Gracias por contactarnos. Para información general sobre nuestra empresa, puedes visitar nuestro sitio web o llamar a nuestro número principal.";
      
      default:
        return "Gracias por tu mensaje. Te responderemos lo antes posible.";
    }
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
   * Procesar mensaje para agente intermediario
   * El sistema envía el mensaje al agente externo (como mensaje enviado)
   * y espera la respuesta del agente (como mensaje recibido)
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
    // Buscar agente asignado a este chat o por palabras clave
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
      
      // Simular delay de respuesta del agente
      if (agent.responseDelay) {
        await new Promise(resolve => setTimeout(resolve, agent.responseDelay * 1000));
      }
      
      // Generar respuesta inteligente basada en el tipo de agente
      const response = await this.generateAgentResponse(agent, message, context);
      
      // Enviar la respuesta del agente como mensaje enviado por nuestro sistema
      await this.sendAgentResponseAsMessage(agent, response, chatId, accountId);
      
      return {
        success: true,
        response: response,
        usage: {
          tokens: message.length + response.length,
          cost: 0.001
        }
      };
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
   * Configurar un agente personalizado
   */
  configureCustomAgent(config: {
    id: string;
    name: string;
    description: string;
    chatId: string;
    accountId: number;
    triggerKeywords?: string[];
    specialization?: string;
    responseDelay?: number;
  }): void {
    this.addAgent({
      ...config,
      isActive: true
    });
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
      agentsBySpecialization: {} as Record<string, number>
    };

    Array.from(this.agents.values()).forEach(agent => {
      const spec = agent.specialization || 'general';
      stats.agentsBySpecialization[spec] = (stats.agentsBySpecialization[spec] || 0) + 1;
    });

    return stats;
  }
}

export const externalAgentService = new ExternalAgentService();