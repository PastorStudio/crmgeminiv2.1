/**
 * Sistema simple de respuestas automáticas para WhatsApp
 * Evita conflictos con el sistema de ticketing
 */

import { SimpleExternalAgentManager, WhatsAppAccountConfigManager } from './externalAgentsSimple';

export class SimpleAutoResponseService {
  /**
   * Procesa un mensaje entrante y envía respuesta automática si está configurado
   */
  static async processIncomingMessage(
    accountId: number,
    chatId: string,
    messageBody: string,
    whatsappClient: any
  ): Promise<boolean> {
    console.log('❌ SISTEMA DE RESPUESTAS SIMPLES DESACTIVADO PERMANENTEMENTE');
    console.log('❌ Usar únicamente agentes externos reales con OpenAI');
    return false;
    
    try {
      console.log(`🔍 Verificando configuración de respuesta automática para cuenta ${accountId}`);
      
      // Obtener configuración de la cuenta
      const config = WhatsAppAccountConfigManager.getAccountConfig(accountId);
      
      if (!config || !config.autoResponseEnabled || !config.assignedExternalAgentId) {
        console.log(`⏭️ Respuesta automática desactivada para cuenta ${accountId}`);
        return false;
      }
      
      console.log(`✅ Configuración encontrada:`, config);
      
      // Obtener agente asignado
      const agent = SimpleExternalAgentManager.getAgent(config.assignedExternalAgentId);
      
      if (!agent || !agent.isActive) {
        console.log(`❌ Agente no encontrado o inactivo: ${config.assignedExternalAgentId}`);
        return false;
      }
      
      console.log(`🤖 Agente encontrado: ${agent.name}`);
      
      // Simular delay configurado
      await new Promise(resolve => setTimeout(resolve, config.responseDelay * 1000));
      
      // Generar respuesta usando el agente externo
      const response = await this.generateResponse(agent, messageBody);
      
      if (response) {
        console.log(`📤 Enviando respuesta automática: "${response}"`);
        
        // Enviar respuesta
        await whatsappClient.sendMessage(chatId, response);
        
        // Actualizar estadísticas del agente
        SimpleExternalAgentManager.updateAgent(agent.id, {
          responseCount: (agent.responseCount || 0) + 1
        });
        
        console.log(`✅ Respuesta automática enviada exitosamente`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Error en respuesta automática:`, error);
      return false;
    }
  }
  
  /**
   * Genera respuesta usando el agente externo
   */
  private static async generateResponse(agent: any, messageBody: string): Promise<string | null> {
    try {
      // Por ahora, usar respuestas predefinidas basadas en el tipo de agente
      const responses = this.getResponsesByAgent(agent.name, messageBody);
      
      if (responses.length > 0) {
        // Seleccionar respuesta aleatoria
        const randomIndex = Math.floor(Math.random() * responses.length);
        return responses[randomIndex];
      }
      
      return null;
    } catch (error) {
      console.error('Error generando respuesta:', error);
      return null;
    }
  }
  
  /**
   * Obtiene respuestas predefinidas basadas en el agente y mensaje
   */
  private static getResponsesByAgent(agentName: string, messageBody: string): string[] {
    const message = messageBody.toLowerCase();
    
    // Respuestas para Agente de Ventas de Telca Panama
    if (agentName.includes('Telca Panama')) {
      if (message.includes('hola') || message.includes('buenos') || message.includes('buenas')) {
        return [
          '¡Hola! 👋 Soy el Asistente de Ventas de Telca Panama. ¿En qué puedo ayudarte hoy con nuestros servicios de telecomunicaciones?',
          '¡Buenos días! 🌟 Gracias por contactar a Telca Panama. Estoy aquí para ayudarte con información sobre nuestros planes y servicios.',
          '¡Saludos! 📱 Bienvenido a Telca Panama. ¿Te interesa conocer nuestras ofertas especiales en internet y telefonía?'
        ];
      }
      
      if (message.includes('ayuda') || message.includes('información') || message.includes('quiero')) {
        return [
          '¡Por supuesto! 💼 En Telca Panama ofrecemos planes de internet residencial y empresarial, telefonía fija y móvil. ¿Qué servicio te interesa más?',
          '🚀 Tenemos excelentes promociones este mes. ¿Buscas internet para casa, oficina o necesitas un plan móvil?',
          '📞 Perfecto, puedo ayudarte con toda la información. ¿Actualmente tienes algún servicio de telecomunicaciones o sería tu primera contratación?'
        ];
      }
      
      if (message.includes('precio') || message.includes('costo') || message.includes('plan')) {
        return [
          '💰 Nuestros planes empiezan desde $19.99 mensuales. ¿Te interesa internet residencial, empresarial o planes móviles?',
          '🎯 Tenemos ofertas especiales según tus necesidades. Para darte el mejor precio, ¿podrías contarme qué tipo de servicio buscas?',
          '💸 Los precios varían según la velocidad y servicios. ¿Cuántas personas usarían el internet en tu hogar/oficina?'
        ];
      }
      
      return [
        '📱 Gracias por tu mensaje. Un ejecutivo de Telca Panama te contactará pronto para brindarte la mejor atención personalizada.',
        '🎯 He recibido tu consulta. Nuestro equipo especializado te responderá a la brevedad con toda la información que necesitas.',
        '⚡ Tu solicitud es importante para nosotros. En breve te contactaremos para ofrecerte la mejor solución en telecomunicaciones.'
      ];
    }
    
    // Respuestas para Smartflyer IA (agente de viajes)
    if (agentName.includes('Smartflyer')) {
      if (message.includes('viaje') || message.includes('vuelo') || message.includes('hotel')) {
        return [
          '✈️ ¡Hola! Soy Smartflyer IA, tu asistente de viajes. ¿A dónde te gustaría viajar?',
          '🌍 ¡Perfecto! Te ayudo a planificar tu viaje ideal. ¿Tienes fechas específicas en mente?',
          '🏨 Excelente, puedo ayudarte con vuelos, hoteles y actividades. ¿Qué destino tienes en mente?'
        ];
      }
      
      return [
        '✈️ ¡Hola! Soy tu asistente de viajes Smartflyer. ¿En qué puedo ayudarte a planificar tu próxima aventura?'
      ];
    }
    
    // Respuestas para Smartplanner IA
    if (agentName.includes('Smartplanner')) {
      return [
        '📋 ¡Hola! Soy Smartplanner IA, tu asistente de planificación. ¿En qué proyecto puedo ayudarte?',
        '🎯 Perfecto, estoy aquí para ayudarte a organizar y planificar. ¿Qué necesitas estructurar?'
      ];
    }
    
    // Respuestas genéricas para otros agentes
    return [
      '👋 ¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?',
      '🤖 Soy tu asistente automático. Un momento por favor, te atenderé enseguida.',
      '📞 He recibido tu mensaje. Te responderé a la brevedad con toda la información que necesitas.'
    ];
  }
}