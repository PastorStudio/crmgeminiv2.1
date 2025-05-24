import axios from 'axios';

interface ExternalAgent {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  headers?: Record<string, string>;
  requestFormat?: 'openai' | 'custom';
  isActive: boolean;
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

  constructor() {
    // Cargar agentes desde configuración o base de datos
    this.loadDefaultAgents();
  }

  /**
   * Cargar agentes predeterminados del sistema
   */
  private loadDefaultAgents() {
    // Agente de ejemplo - SmartBots personalizado
    this.addAgent({
      id: 'smartbots-custom',
      name: 'SmartBots Custom Agent',
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      requestFormat: 'openai',
      isActive: true
    });

    console.log('🤖 Agentes externos cargados exitosamente');
  }

  /**
   * Agregar un nuevo agente externo
   */
  addAgent(agent: ExternalAgent): void {
    this.agents.set(agent.id, agent);
    console.log(`✅ Agente externo agregado: ${agent.name} (${agent.id})`);
  }

  /**
   * Obtener lista de agentes disponibles
   */
  getAgents(): ExternalAgent[] {
    return Array.from(this.agents.values()).filter(agent => agent.isActive);
  }

  /**
   * Obtener un agente específico
   */
  getAgent(agentId: string): ExternalAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Enviar mensaje a un agente externo
   */
  async sendMessageToAgent(
    agentId: string,
    message: string,
    chatContext?: string[],
    userInfo?: {
      name?: string;
      phone?: string;
      chatId?: string;
    }
  ): Promise<ExternalAgentResponse> {
    try {
      const agent = this.agents.get(agentId);
      
      if (!agent) {
        return {
          success: false,
          response: '',
          error: `Agente ${agentId} no encontrado`
        };
      }

      if (!agent.isActive) {
        return {
          success: false,
          response: '',
          error: `Agente ${agent.name} está desactivado`
        };
      }

      console.log(`🤖 Enviando mensaje a agente ${agent.name}: "${message}"`);

      // Preparar el payload según el formato del agente
      const payload = this.prepareAgentPayload(agent, message, chatContext, userInfo);
      
      // Realizar la petición HTTP
      const response = await axios.post(agent.url, payload, {
        headers: agent.headers || {},
        timeout: 30000, // 30 segundos timeout
      });

      // Procesar la respuesta según el formato del agente
      const agentResponse = this.processAgentResponse(agent, response.data);

      console.log(`✅ Respuesta del agente ${agent.name}: "${agentResponse.response}"`);

      return agentResponse;

    } catch (error) {
      console.error(`❌ Error comunicándose con agente ${agentId}:`, error);
      
      return {
        success: false,
        response: '',
        error: `Error de comunicación con el agente: ${error.message}`
      };
    }
  }

  /**
   * Preparar payload para diferentes tipos de agentes
   */
  private prepareAgentPayload(
    agent: ExternalAgent,
    message: string,
    chatContext?: string[],
    userInfo?: any
  ): any {
    if (agent.requestFormat === 'openai') {
      // Formato compatible con OpenAI API
      const messages = [
        {
          role: 'system',
          content: `Eres un asistente especializado para WhatsApp Business. Responde de manera amigable y profesional. ${userInfo?.name ? `El usuario se llama ${userInfo.name}.` : ''} ${userInfo?.phone ? `Su teléfono es ${userInfo.phone}.` : ''}`
        }
      ];

      // Agregar contexto del chat si está disponible
      if (chatContext && chatContext.length > 0) {
        chatContext.slice(-5).forEach(contextMessage => {
          messages.push({
            role: 'user',
            content: contextMessage
          });
        });
      }

      // Agregar el mensaje actual
      messages.push({
        role: 'user',
        content: message
      });

      return {
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages,
        max_tokens: 500,
        temperature: 0.7
      };
    }

    // Formato personalizado genérico
    return {
      message,
      context: chatContext,
      user: userInfo
    };
  }

  /**
   * Procesar respuesta de diferentes tipos de agentes
   */
  private processAgentResponse(agent: ExternalAgent, responseData: any): ExternalAgentResponse {
    if (agent.requestFormat === 'openai') {
      // Procesar respuesta de OpenAI API
      if (responseData.choices && responseData.choices.length > 0) {
        return {
          success: true,
          response: responseData.choices[0].message.content.trim(),
          usage: {
            tokens: responseData.usage?.total_tokens || 0,
            cost: (responseData.usage?.total_tokens || 0) * 0.00002 // Estimación de costo
          }
        };
      }
    }

    // Intentar procesar formato genérico
    if (responseData.response) {
      return {
        success: true,
        response: responseData.response
      };
    }

    if (responseData.message) {
      return {
        success: true,
        response: responseData.message
      };
    }

    // Si no se puede procesar, devolver la respuesta completa como string
    return {
      success: true,
      response: JSON.stringify(responseData)
    };
  }

  /**
   * Configurar un agente desde URL personalizada
   */
  configureCustomAgent(config: {
    id: string;
    name: string;
    url: string;
    apiKey?: string;
    headers?: Record<string, string>;
    requestFormat?: 'openai' | 'custom';
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
      console.log(`⏸️ Agente ${agent.name} desactivado`);
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
      console.log(`▶️ Agente ${agent.name} activado`);
      return true;
    }
    return false;
  }

  /**
   * Obtener estadísticas de uso de agentes
   */
  getAgentStats(): Record<string, any> {
    return {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.isActive).length,
      agentList: this.getAgents().map(a => ({
        id: a.id,
        name: a.name,
        isActive: a.isActive
      }))
    };
  }
}

// Exportar instancia singleton
export const externalAgentService = new ExternalAgentService();