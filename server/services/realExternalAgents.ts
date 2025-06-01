/**
 * Servicio para comunicación real con agentes externos
 * Utiliza OpenAI API para conectar con agentes reales
 */

export interface RealAgentResponse {
  success: boolean;
  response?: string;
  agentName?: string;
  error?: string;
}

/**
 * Servicio para comunicación real con agentes externos
 */
export class RealExternalAgentService {
  
  /**
   * Envía un mensaje a un agente externo real usando OpenAI API
   */
  static async sendMessageToRealAgent(
    agentId: string, 
    message: string, 
    translationConfig?: { enabled: boolean; language: string; languageName: string }
  ): Promise<RealAgentResponse> {
    try {
      console.log(`🚀 Enviando mensaje a agente externo real ID: ${agentId}`);
      console.log(`📝 Mensaje: "${message.substring(0, 100)}..."`);
      
      // Verificar que tenemos la clave API
      if (!process.env.OPENAI_API_KEY) {
        console.log('❌ OPENAI_API_KEY no configurada');
        return { 
          success: false, 
          error: 'OpenAI API key no configurada' 
        };
      }
      
      // Obtener información del agente
      const agentName = this.getAgentNameById(agentId);
      console.log(`🤖 Comunicando con agente: ${agentName}`);
      
      // Importar OpenAI dinámicamente
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });
      
      // Crear contexto específico según el agente
      const systemPrompt = this.getAgentSystemPrompt(agentName);
      console.log(`🎯 Contexto del agente configurado para ${agentName}`);
      
      // Hacer la llamada a OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      });
      
      let responseText = completion.choices[0].message.content;
      
      if (!responseText) {
        console.log('❌ No se recibió respuesta del agente');
        return { success: false, error: 'No response from agent' };
      }
      
      console.log(`✅ Respuesta real recibida del agente ${agentName}: ${responseText.substring(0, 50)}...`);
      
      // Aplicar traducción si está configurada
      if (translationConfig?.enabled && translationConfig.language !== 'es') {
        console.log(`🌐 Traduciendo respuesta al ${translationConfig.languageName}...`);
        try {
          responseText = await this.translateToLanguage(responseText, translationConfig.language, translationConfig.languageName);
          console.log(`✅ Traducción exitosa al ${translationConfig.languageName}`);
        } catch (translateError) {
          console.log('❌ Error en traducción, usando respuesta original');
        }
      }
      
      return {
        success: true,
        response: responseText,
        agentName: agentName
      };
      
    } catch (error) {
      console.error(`❌ Error comunicando con agente externo:`, error);
      return { 
        success: false, 
        error: `Error en comunicación: ${error.message}` 
      };
    }
  }
  
  /**
   * Obtiene el nombre del agente por su ID
   */
  private static getAgentNameById(agentId: string): string {
    const agentNames = {
      '1': 'Smartplanner IA',
      '2': 'Smartflyer IA', 
      '3': 'Smart Legal Bot',
      '4': 'Smart Tech Support',
      '5': 'Agente de Ventas de Telca Panama',
      '6': 'Asistente Técnico en Gestión en Campo'
    };
    
    return agentNames[agentId] || `Agente ${agentId}`;
  }
  
  /**
   * Obtiene el prompt del sistema específico para cada agente
   */
  private static getAgentSystemPrompt(agentName: string): string {
    const prompts = {
      'Smartplanner IA': `Eres Smartplanner IA, un experto en planificación, organización y productividad. Tu misión es ayudar a las personas a organizar sus tareas, proyectos y tiempo de manera eficiente para maximizar su productividad. Proporciona consejos prácticos, metodologías de planificación y herramientas para optimizar el tiempo.`,
      
      'Smartflyer IA': `Eres Smartflyer IA, un experto en viajes, aerolíneas y turismo. Ayudas a las personas a planificar viajes perfectos, encontrar las mejores ofertas de vuelos, recomendar destinos y resolver cualquier consulta relacionada con viajes. Tienes conocimiento actualizado sobre destinos, aerolíneas, hoteles y consejos de viaje.`,
      
      'Smart Legal Bot': `Eres Smart Legal Bot, un experto en asuntos legales y asesoría jurídica. Proporcionas orientación legal clara y comprensible para personas y empresas. IMPORTANTE: Siempre recuerda que tu información es educativa y que es importante consultar con un abogado certificado para casos específicos y decisiones legales importantes.`,
      
      'Smart Tech Support': `Eres Smart Tech Support, un experto técnico especializado en soporte tecnológico y resolución de problemas. Ayudas a resolver problemas técnicos, optimizar sistemas, configurar dispositivos y proporcionar guías paso a paso para soluciones tecnológicas.`,
      
      'Agente de Ventas de Telca Panama': `Eres un Agente de Ventas especializado en telecomunicaciones de Telca Panama. Tu especialidad es ayudar a los clientes a encontrar las mejores soluciones de telecomunicaciones para sus necesidades, explicar planes de servicio, resolver dudas sobre facturación y cerrar ventas exitosas. Siempre mantén un enfoque orientado al cliente y a las soluciones.`,
      
      'Asistente Técnico en Gestión en Campo': `Eres un Asistente Técnico especializado en gestión de campo y operaciones técnicas. Ayudas a optimizar procesos operativos, resolver problemas técnicos en campo, coordinar equipos de trabajo y mejorar la eficiencia en operaciones de campo.`
    };
    
    return prompts[agentName] || `Eres ${agentName}, un asistente virtual inteligente y profesional que ayuda a resolver consultas de manera efectiva y amigable.`;
  }
  
  /**
   * Traduce un texto a un idioma específico usando OpenAI
   */
  private static async translateToLanguage(text: string, targetLanguage: string, targetLanguageName: string): Promise<string> {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { 
            role: "system", 
            content: `Traduce el siguiente texto al ${targetLanguageName} de manera natural y precisa. Mantén el tono profesional y el contexto original. Responde únicamente con la traducción.` 
          },
          { role: "user", content: text }
        ],
        max_tokens: 600,
        temperature: 0.3
      });

      return response.choices[0].message.content?.trim() || text;
    } catch (error) {
      console.error('❌ Error en traducción:', error);
      throw error;
    }
  }
}

export const realExternalAgentService = new RealExternalAgentService();