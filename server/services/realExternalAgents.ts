import { db } from '../db';
import { externalAgents } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
   * Envía un mensaje a un agente externo real usando su URL
   */
  static async sendMessageToRealAgent(agentId: string, message: string, translationConfig?: { enabled: boolean; language: string; languageName: string }): Promise<RealAgentResponse> {
    try {
      console.log(`🌐 COMUNICACIÓN REAL CON AGENTE EXTERNO ${agentId}: "${message.substring(0, 50)}..."`);
      
      // Obtener información del agente desde la base de datos
      const [agent] = await db
        .select()
        .from(externalAgents)
        .where(eq(externalAgents.id, agentId))
        .limit(1);
      
      if (!agent) {
        console.log(`❌ Agente externo ${agentId} no encontrado`);
        return { success: false, error: 'Agente no encontrado' };
      }
      
      console.log(`🔗 Conectando con agente real: ${agent.agentName} (${agent.agentUrl})`);
      
      // Intentar comunicación real con el agente externo
      const realResponse = await this.communicateWithExternalAgent(agent.agentUrl, message, agent.agentName);
      
      if (realResponse.success && realResponse.response) {
        let finalResponse = realResponse.response;
        
        // Aplicar traducción si está configurada
        if (translationConfig?.enabled && translationConfig.language !== 'es') {
          console.log(`🌐 Traduciendo respuesta del agente real al ${translationConfig.languageName}...`);
          finalResponse = await this.translateToLanguage(finalResponse, translationConfig.language, translationConfig.languageName);
          console.log(`📝 Respuesta del agente real traducida: "${finalResponse.substring(0, 50)}..."`);
        }
        
        console.log(`✅ RESPUESTA REAL DEL AGENTE ${agent.agentName}: ${finalResponse.substring(0, 50)}...`);
        
        return {
          success: true,
          response: finalResponse,
          agentName: agent.agentName
        };
      }
      
      // Si falla la comunicación real, usar fallback pero informar al usuario
      console.log(`⚠️ Comunicación real con ${agent.agentName} falló, usando respuesta simulada`);
      return this.simulateAgentResponse(agent.agentName, message, translationConfig);
      
    } catch (error) {
      console.error('❌ Error en comunicación con agente externo real:', error);
      return { success: false, error: 'Error de comunicación' };
    }
  }
  
  /**
   * Comunica directamente con el agente externo usando su URL real
   */
  private static async communicateWithExternalAgent(agentUrl: string, message: string, agentName: string): Promise<{ success: boolean; response?: string }> {
    try {
      console.log(`🚀 Intentando comunicación directa con ${agentName} en ${agentUrl}`);
      
      // Para agentes de ChatGPT (URLs que contienen chatgpt.com)
      if (agentUrl.includes('chatgpt.com')) {
        return await this.communicateWithChatGPTAgent(agentUrl, message, agentName);
      }
      
      // Para otros tipos de agentes externos
      return await this.communicateWithGenericAgent(agentUrl, message, agentName);
      
    } catch (error) {
      console.error(`❌ Error comunicando con agente ${agentName}:`, error);
      return { success: false };
    }
  }
  
  /**
   * Comunicación con agentes de ChatGPT usando puppeteer
   */
  private static async communicateWithChatGPTAgent(agentUrl: string, message: string, agentName: string): Promise<{ success: boolean; response?: string }> {
    try {
      console.log(`🤖 Comunicando con agente ChatGPT: ${agentName}`);
      
      // Importar puppeteer dinámicamente
      const puppeteer = require('puppeteer');
      
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Configurar user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      try {
        // Navegar a la URL del agente
        await page.goto(agentUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Esperar a que la página cargue completamente
        await page.waitForTimeout(3000);
        
        // Buscar el área de texto para enviar mensajes
        const messageInput = await page.$('textarea[placeholder*="Message"], textarea[data-id*="root"], #prompt-textarea');
        
        if (messageInput) {
          console.log(`📝 Enviando mensaje a ${agentName}: "${message}"`);
          
          // Escribir el mensaje
          await messageInput.type(message);
          
          // Buscar y hacer click en el botón de enviar
          const sendButton = await page.$('button[data-testid="send-button"], button[aria-label*="Send"], button:has-text("Send")');
          
          if (sendButton) {
            await sendButton.click();
            
            // Esperar a que aparezca la respuesta
            await page.waitForTimeout(5000);
            
            // Buscar la respuesta del agente
            const responseElements = await page.$$('[data-message-author-role="assistant"] .markdown, .response-text, .assistant-message');
            
            if (responseElements.length > 0) {
              const lastResponse = responseElements[responseElements.length - 1];
              const responseText = await page.evaluate(el => el.textContent, lastResponse);
              
              if (responseText && responseText.trim()) {
                console.log(`✅ Respuesta real recibida de ${agentName}: "${responseText.substring(0, 100)}..."`);
                await browser.close();
                return { success: true, response: responseText.trim() };
              }
            }
          }
        }
        
        console.log(`⚠️ No se pudo obtener respuesta real de ${agentName}`);
        await browser.close();
        return { success: false };
        
      } catch (pageError) {
        console.error(`❌ Error en la página del agente ${agentName}:`, pageError);
        await browser.close();
        return { success: false };
      }
      
    } catch (error) {
      console.error(`❌ Error en comunicación con ChatGPT ${agentName}:`, error);
      return { success: false };
    }
  }
  
  /**
   * Comunicación con agentes genéricos usando fetch/API
   */
  private static async communicateWithGenericAgent(agentUrl: string, message: string, agentName: string): Promise<{ success: boolean; response?: string }> {
    try {
      console.log(`🌐 Comunicando con agente genérico: ${agentName}`);
      
      // Intentar comunicación via API REST
      const response = await fetch(agentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-CRM-Integration/1.0'
        },
        body: JSON.stringify({
          message: message,
          timestamp: new Date().toISOString()
        }),
        timeout: 15000
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.response || data.message || data.text) {
          const agentResponse = data.response || data.message || data.text;
          console.log(`✅ Respuesta real recibida de ${agentName}: "${agentResponse.substring(0, 100)}..."`);
          return { success: true, response: agentResponse };
        }
      }
      
      console.log(`⚠️ No se pudo obtener respuesta API de ${agentName}`);
      return { success: false };
      
    } catch (error) {
      console.error(`❌ Error en comunicación genérica con ${agentName}:`, error);
      return { success: false };
    }
  }
  
  /**
   * Respuesta simulada cuando la comunicación real falla
   */
  private static async simulateAgentResponse(agentName: string, message: string, translationConfig?: { enabled: boolean; language: string; languageName: string }): Promise<RealAgentResponse> {
    try {
      console.log(`🔄 FALLBACK: Generando respuesta simulada para ${agentName}`);
      
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const systemPrompt = `IMPORTANTE: Actúas como ${agentName} pero la comunicación real con el agente externo falló.
      Informa al usuario que eres una versión simulada temporal y que el agente real no está disponible en este momento.
      Luego proporciona una respuesta útil basada en el contexto del agente.
      
      Contexto del agente: ${this.getAgentContext(agentName)}`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });
      
      let simulatedResponse = response.choices[0].message.content || 'Lo siento, no pude procesar tu mensaje.';
      
      // Aplicar traducción si está configurada
      if (translationConfig?.enabled && translationConfig.language !== 'es') {
        console.log(`🌐 Traduciendo respuesta simulada al ${translationConfig.languageName}...`);
        simulatedResponse = await this.translateToLanguage(simulatedResponse, translationConfig.language, translationConfig.languageName);
      }
      
      return {
        success: true,
        response: simulatedResponse,
        agentName: `${agentName} (Simulado)`
      };
      
    } catch (error) {
      console.error('❌ Error en respuesta simulada:', error);
      return { success: false, error: 'Error en respuesta simulada' };
    }
  }
  
  /**
   * Obtiene el contexto de un agente basado en su nombre
   */
  private static getAgentContext(agentName: string): string {
    const contexts = {
      'Smartplanner IA': 'Especializado en planificación y organización de tareas',
      'Smartflyer IA': 'Especializado en viajes y gestión de vuelos',
      'Smart Legal Bot': 'Especializado en asesoría legal básica',
      'Smart Tech Support': 'Especializado en soporte técnico',
      'Agente de Ventas de Telca Panama': 'Especializado en ventas de telecomunicaciones',
      'Asistente Técnico en Gestión en Campo': 'Especializado en gestión de campo técnico'
    };
    
    return contexts[agentName] || 'Asistente general';
  }
  
  /**
   * Traduce un texto a un idioma específico
   */
  private static async translateToLanguage(text: string, targetLanguage: string, targetLanguageName: string): Promise<string> {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `Traduce el siguiente texto al ${targetLanguageName} de manera natural y precisa. Mantén el tono y el contexto original. Responde únicamente con la traducción.` 
          },
          { role: "user", content: text }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      return response.choices[0].message.content?.trim() || text;
    } catch (error) {
      console.error('❌ Error traduciendo:', error);
      return text;
    }
  }
}

export const realExternalAgentService = new RealExternalAgentService();