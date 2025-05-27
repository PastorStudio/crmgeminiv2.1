/**
 * Servicio de Agentes Independientes
 * 
 * Este servicio permite seleccionar y usar agentes externos de manera independiente
 * de las configuraciones de WhatsApp, funcionando como intermediarios invisibles
 * para generar respuestas usando OpenAI.
 */

import OpenAI from 'openai';

// Configuración de OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY 
});

// Lista de agentes predefinidos (independientes de la base de datos)
const independentAgents = [
  {
    id: "1",
    name: "Smartbots",
    description: "Asistente inteligente para consultas generales",
    context: "Eres Smartbots, un asistente inteligente especializado en resolver consultas generales de manera clara y eficiente."
  },
  {
    id: "2", 
    name: "Smartplanner IA",
    description: "Especialista en planificación y organización",
    context: "Eres Smartplanner IA, un experto en planificación, organización y gestión de proyectos. Ayudas a crear planes detallados y optimizar procesos."
  },
  {
    id: "3",
    name: "Smartflyer IA", 
    description: "Experto en viajes y logística",
    context: "Eres Smartflyer IA, un especialista en viajes, logística y gestión de itinerarios. Proporcionas información detallada sobre destinos, vuelos y planificación de viajes."
  },
  {
    id: "4",
    name: "Agente de Ventas de Telca Panama",
    description: "Especialista en telecomunicaciones",
    context: "Eres un agente de ventas especializado en telecomunicaciones de Telca Panama. Conoces todos los productos, servicios, planes y promociones. Eres profesional, amigable y orientado a resultados."
  },
  {
    id: "5",
    name: "Asistente Técnico en Gestión en Campo",
    description: "Experto en gestión técnica de campo",
    context: "Eres un asistente técnico especializado en gestión de operaciones de campo. Proporcionas soporte técnico, soluciones prácticas y orientación para trabajos en terreno."
  }
];

export class IndependentAgentService {
  
  /**
   * Obtener lista de agentes independientes disponibles
   */
  static getAvailableAgents() {
    return {
      success: true,
      agents: independentAgents
    };
  }

  /**
   * Generar respuesta usando un agente seleccionado
   */
  static async generateResponse(agentId: string, userMessage: string, contactName: string) {
    try {
      // Buscar el agente seleccionado
      const selectedAgent = independentAgents.find(agent => agent.id === agentId);
      
      if (!selectedAgent) {
        return {
          success: false,
          message: "Agente no encontrado"
        };
      }

      console.log(`🤖 Generando respuesta con ${selectedAgent.name} para: ${userMessage}`);

      // Crear el prompt personalizado para el agente
      const systemPrompt = `${selectedAgent.context}

Información del contexto:
- Estás respondiendo a un mensaje de WhatsApp de ${contactName}
- Mantén un tono profesional pero amigable
- Responde de manera concisa y clara
- Si no sabes algo específico, sé honesto pero ofrece alternativas útiles

Mensaje del usuario: "${userMessage}"

Genera una respuesta apropiada:`;

      // Generar respuesta usando OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: userMessage
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const generatedResponse = response.choices[0]?.message?.content;

      if (!generatedResponse) {
        throw new Error("No se pudo generar una respuesta");
      }

      console.log(`✅ Respuesta generada por ${selectedAgent.name}: ${generatedResponse.substring(0, 100)}...`);

      return {
        success: true,
        response: generatedResponse.trim(),
        agentName: selectedAgent.name,
        agentId: agentId
      };

    } catch (error) {
      console.error('❌ Error generando respuesta:', error);
      
      return {
        success: false,
        message: `Error al generar respuesta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        fallbackResponse: "Lo siento, no pude procesar tu solicitud en este momento. ¿Podrías intentar reformular tu pregunta?"
      };
    }
  }

  /**
   * Obtener información específica de un agente
   */
  static getAgentInfo(agentId: string) {
    const agent = independentAgents.find(a => a.id === agentId);
    
    if (!agent) {
      return {
        success: false,
        message: "Agente no encontrado"
      };
    }

    return {
      success: true,
      agent: agent
    };
  }

  /**
   * Probar conectividad con un agente (genera una respuesta de prueba)
   */
  static async testAgent(agentId: string) {
    try {
      const testMessage = "Hola, esta es una prueba de conectividad.";
      const result = await this.generateResponse(agentId, testMessage, "Usuario de Prueba");
      
      return {
        success: result.success,
        message: result.success ? "Agente funcionando correctamente" : "Error en el agente",
        testResponse: result.response || result.fallbackResponse
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Error probando agente: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
}

export default IndependentAgentService;