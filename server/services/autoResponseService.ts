import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import * as googleai from '@google/generative-ai';

// Tipo de datos para la plantilla de respuesta automática
interface ResponseTemplate {
  id: string;
  name: string;
  pattern?: string;
  template: string;
  autoDetect: boolean;
}

// Configuración de respuestas automáticas
interface AutoResponseConfig {
  enabled: boolean;
  delaySeconds: number;
  templates: ResponseTemplate[];
  useProfessionLevel: boolean;
  defaultTemplate: string;
  enabledForGroups: boolean;
  enabledForBroadcast: boolean;
  excludedContacts: string[];
  aiProvider: "gemini" | "openai"; // Nueva propiedad para seleccionar el proveedor de IA
  customPrompts: {
    enabled: boolean;
    system: string;
    temperature: number;
    maxTokens: number;
  };
}

// Configuración predeterminada
const defaultConfig: AutoResponseConfig = {
  enabled: false,
  delaySeconds: 10,
  templates: [
    {
      id: "default",
      name: "Respuesta estándar",
      template: "Hola, gracias por tu mensaje. En breve nos pondremos en contacto contigo.",
      autoDetect: true
    },
    {
      id: "busy",
      name: "Fuera de horario",
      pattern: "urgente|emergencia|ayuda",
      template: "Hola, actualmente estamos fuera de horario laboral. Sin embargo, hemos registrado tu mensaje y te responderemos lo antes posible.",
      autoDetect: false
    }
  ],
  useProfessionLevel: true,
  enabledForGroups: false,
  enabledForBroadcast: false,
  defaultTemplate: "default",
  excludedContacts: [],
  aiProvider: "gemini", // Por defecto usamos Gemini
  customPrompts: {
    enabled: false,
    system: "Eres un asistente virtual amable y profesional que responde preguntas de clientes. Tu objetivo es proporcionar información clara y útil, resolver dudas específicas, y derivar a un agente humano cuando sea necesario. Nunca inventes información y siempre mantén un tono respetuoso y amigable.",
    temperature: 0.7,
    maxTokens: 500
  }
};

// Mapa para almacenar temporizadores de respuesta por contacto
const responseTimers: Map<string, NodeJS.Timeout> = new Map();

// Mapa para evitar respuestas duplicadas (mensajeId -> booleano)
const responseSent: Map<string, boolean> = new Map();

/**
 * Clase que gestiona las respuestas automáticas de WhatsApp utilizando Gemini AI
 */
export class AutoResponseService {
  private config: AutoResponseConfig;
  private geminiClient: GoogleGenerativeAI | null = null;
  private openaiClient: OpenAI | null = null;
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'temp', 'auto-response-config.json');
    this.config = this.loadConfig();
    this.initAIClients();
  }

  /**
   * Inicializa los clientes de IA (Gemini y OpenAI)
   */
  private initAIClients(): void {
    // Inicializar Gemini
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY no está definida. Algunas funciones de IA de Gemini estarán limitadas.');
      } else {
        this.geminiClient = new googleai.GoogleGenerativeAI(apiKey);
        console.log('Cliente Gemini inicializado correctamente');
      }
    } catch (error) {
      console.error('Error al inicializar el cliente de Gemini:', error);
    }

    // Inicializar OpenAI
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('OPENAI_API_KEY no está definida. Algunas funciones de IA de OpenAI estarán limitadas.');
      } else {
        this.openaiClient = new OpenAI({ apiKey });
        console.log('Cliente OpenAI inicializado correctamente');
      }
    } catch (error) {
      console.error('Error al inicializar el cliente de OpenAI:', error);
    }
  }

  /**
   * Carga la configuración desde un archivo o utiliza la configuración predeterminada
   */
  private loadConfig(): AutoResponseConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Error al cargar la configuración de respuestas automáticas:', error);
    }
    
    // Si hay algún error o el archivo no existe, usar la configuración predeterminada
    return { ...defaultConfig };
  }

  /**
   * Guarda la configuración en un archivo
   */
  private saveConfig(): void {
    try {
      const dirPath = path.dirname(this.configPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error al guardar la configuración de respuestas automáticas:', error);
    }
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): AutoResponseConfig {
    return { ...this.config };
  }

  /**
   * Actualiza la configuración
   */
  updateConfig(newConfig: AutoResponseConfig): AutoResponseConfig {
    // Validar configuración básica
    if (typeof newConfig.enabled !== 'boolean' || 
        typeof newConfig.delaySeconds !== 'number' ||
        !Array.isArray(newConfig.templates)) {
      throw new Error('Configuración de respuesta automática inválida');
    }

    this.config = { ...newConfig };
    this.saveConfig();
    return this.getConfig();
  }

  /**
   * Cancela una respuesta automática programada para un contacto
   */
  cancelPendingResponse(contactId: string): boolean {
    const timer = responseTimers.get(contactId);
    if (timer) {
      clearTimeout(timer);
      responseTimers.delete(contactId);
      return true;
    }
    return false;
  }

  /**
   * Verifica si se debe enviar una respuesta automática
   */
  shouldAutoRespond(message: any): boolean {
    if (!this.config.enabled) return false;
    
    // Verificar si ya se ha respondido a este mensaje
    if (message.id && responseSent.has(message.id)) return false;
    
    // Verificar si el contacto está excluido
    if (message.from && this.config.excludedContacts.includes(message.from)) return false;
    
    // Verificar si es un grupo y si debemos responder a grupos
    if (message.isGroupMsg && !this.config.enabledForGroups) return false;
    
    // Verificar si es un broadcast y si debemos responder a broadcasts
    if (message.broadcast && !this.config.enabledForBroadcast) return false;
    
    return true;
  }

  /**
   * Maneja un mensaje entrante y programa una respuesta automática si es necesario
   */
  async handleIncomingMessage(message: any): Promise<void> {
    if (!this.shouldAutoRespond(message)) return;
    
    // Marcar el mensaje como respondido para evitar respuestas duplicadas
    if (message.id) {
      responseSent.set(message.id, true);
      
      // Limpieza después de 24 horas para evitar crecimiento indefinido del Map
      setTimeout(() => {
        responseSent.delete(message.id);
      }, 24 * 60 * 60 * 1000);
    }
    
    // Encontrar la plantilla adecuada
    let templateToUse = await this.findMatchingTemplate(message);
    
    // Programar la respuesta automática
    const contactId = message.from;
    const delay = this.config.delaySeconds * 1000;
    
    // Cancelar cualquier respuesta pendiente al mismo contacto
    this.cancelPendingResponse(contactId);
    
    // Programar la nueva respuesta
    const timer = setTimeout(async () => {
      try {
        await this.sendAutoResponse(message, templateToUse);
        responseTimers.delete(contactId);
      } catch (error) {
        console.error('Error al enviar respuesta automática:', error);
      }
    }, delay);
    
    responseTimers.set(contactId, timer);
  }

  /**
   * Encuentra la plantilla más adecuada para un mensaje
   */
  private async findMatchingTemplate(message: any): Promise<ResponseTemplate> {
    const messageText = message.body || '';
    
    // 1. Buscar por patrón explícito primero
    for (const template of this.config.templates) {
      if (template.pattern) {
        const regex = new RegExp(template.pattern, 'i');
        if (regex.test(messageText)) {
          return template;
        }
      }
    }
    
    // 2. Si hay plantillas con autoDetect, intentar usar Gemini para determinar la mejor
    const autoDetectTemplates = this.config.templates.filter(t => t.autoDetect);
    if (autoDetectTemplates.length > 0 && this.geminiClient) {
      try {
        // Usar Gemini para analizar el mensaje y determinar la mejor plantilla
        const bestTemplate = await this.determineTemplateWithAI(messageText, autoDetectTemplates);
        if (bestTemplate) {
          return bestTemplate;
        }
      } catch (error) {
        console.error('Error al determinar plantilla con IA:', error);
      }
    }
    
    // 3. Usar la plantilla predeterminada si está definida
    if (this.config.defaultTemplate) {
      const defaultTemplate = this.config.templates.find(t => t.id === this.config.defaultTemplate);
      if (defaultTemplate) {
        return defaultTemplate;
      }
    }
    
    // 4. Último recurso: usar la primera plantilla disponible
    return this.config.templates[0] || {
      id: 'fallback',
      name: 'Respuesta de emergencia',
      template: 'Gracias por tu mensaje. Nos pondremos en contacto contigo lo antes posible.',
      autoDetect: false
    };
  }

  /**
   * Determina la mejor plantilla para un mensaje utilizando el proveedor de IA configurado
   */
  private async determineTemplateWithAI(messageText: string, templates: ResponseTemplate[]): Promise<ResponseTemplate | null> {
    if (!templates || templates.length === 0) return null;
    
    // Verificar si tenemos algún cliente de IA disponible
    if (!this.geminiClient && !this.openaiClient) {
      console.log("No hay cliente de IA disponible para determinar plantilla");
      return null;
    }
    
    try {
      // Crear descripciones de plantillas para el prompt
      const templateDescriptions = templates.map((t, i) => 
        `Template ${i + 1}: "${t.name}" - ${t.template}`
      ).join('\n');
      
      const prompt = `
        Analiza el siguiente mensaje y determina cuál de estas plantillas es la más adecuada para responder.
        
        Mensaje: "${messageText}"
        
        Plantillas disponibles:
        ${templateDescriptions}
        
        Responde solo con el número de la plantilla más adecuada (1, 2, 3, etc.).
      `;
      
      let responseText = "";
      
      // Usar OpenAI si está configurado como proveedor
      if (this.config.aiProvider === "openai" && this.openaiClient) {
        try {
          console.log("Usando OpenAI para determinar plantilla");
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o", // el modelo más reciente de OpenAI
            messages: [{ role: "user", content: prompt }] as any,
            temperature: 0, // Usamos temperatura baja para respuestas más deterministas
            max_tokens: 10, // Solo necesitamos un número
          });
          
          responseText = response.choices[0].message.content || "";
          console.log("Respuesta de OpenAI:", responseText);
        } catch (error) {
          console.error("Error al determinar plantilla con OpenAI:", error);
          // Si falla OpenAI y tenemos Gemini disponible, intentamos con él
          if (this.geminiClient) {
            console.log("Cambiando a Gemini tras error con OpenAI");
          } else {
            return null; // No podemos continuar sin ningún proveedor
          }
        }
      }
      
      // Usar Gemini si está configurado como proveedor o si OpenAI falló
      if ((this.config.aiProvider === "gemini" || responseText === "") && this.geminiClient) {
        try {
          console.log("Usando Gemini para determinar plantilla");
          const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
          const result = await model.generateContent(prompt);
          responseText = result.response.text().trim();
          console.log("Respuesta de Gemini:", responseText);
        } catch (error) {
          console.error('Error al determinar plantilla con Gemini:', error);
          if (responseText === "") {
            return null; // No tenemos respuesta de ningún proveedor
          }
          // Si ya teníamos respuesta de OpenAI, continuamos con ella
        }
      }
      
      // Procesamos la respuesta para extraer el número de la plantilla
      const match = responseText.match(/\d+/);
      if (match) {
        const templateIndex = parseInt(match[0]) - 1;
        if (templateIndex >= 0 && templateIndex < templates.length) {
          return templates[templateIndex];
        }
      }
      
      console.log(`No se pudo extraer un índice válido de la respuesta: "${responseText}"`);
      return null;
    } catch (error) {
      console.error('Error general al determinar plantilla con IA:', error);
      return null;
    }
  }

  /**
   * Envía una respuesta automática
   */
  private async sendAutoResponse(message: any, template: ResponseTemplate): Promise<void> {
    if (!template) return;
    
    try {
      console.log('Preparando respuesta automática para mensaje:', message.body);
      
      // Obtener el nombre del contacto si está disponible
      let contactName = 'cliente';
      let previousMessages = [];
      
      // Verificar si tenemos información de contacto en el mensaje
      if (message.from) {
        try {
          // Importar servicios bajo demanda
          const { whatsappService } = await import('./whatsappServiceImpl');
          
          // Intentar obtener el nombre del contacto
          try {
            // Obtener chats disponibles
            const chats = await whatsappService.getChats();
            // Buscar el chat correspondiente al remitente
            const matchingChat = chats.find(c => c.id === message.from);
            if (matchingChat && matchingChat.name) {
              contactName = matchingChat.name.split(' ')[0]; // Primer nombre
            } else {
              // Usar número formateado como nombre
              contactName = message.from.split('@')[0];
            }
          } catch (err) {
            console.log('No se pudo obtener nombre de contacto:', err);
          }
          
          // Intentar obtener mensajes previos para contexto
          try {
            // Obtener mensajes del chat
            const messages = await whatsappService.getMessages(message.from, 5);
            if (messages && messages.length > 0) {
              previousMessages = messages.map((m: any) => ({
                role: m.fromMe ? 'assistant' : 'user',
                content: m.body || ''
              }));
              console.log('Contexto de mensajes previos cargado:', previousMessages.length);
            }
          } catch (err) {
            console.log('No se pudieron obtener mensajes previos:', err);
          }
        } catch (err) {
          // En caso de error, usar el número como nombre
          contactName = message.from.split('@')[0];
          console.log('Usando número como nombre de contacto:', contactName);
        }
      }
      
      let responseText = '';
      
      // Decidir si usar IA generativa basada en prompts personalizados o la plantilla tradicional
      if (this.config.customPrompts.enabled) {
        try {
          // Preparar el mensaje del sistema con el prompt personalizado
          const systemPrompt = this.config.customPrompts.system
            .replace(/{{nombre}}/g, contactName);
            
          // Determinar qué proveedor de IA usar
          if (this.config.aiProvider === "openai" && this.openaiClient) {
            // Usar OpenAI para generar la respuesta
            console.log("Usando OpenAI para la respuesta automática");
            
            // Convertir los mensajes anteriores al formato de OpenAI
            const openaiMessages: Array<{role: string, content: string}> = [];
            
            // Añadir el sistema prompt
            openaiMessages.push({
              role: "system",
              content: systemPrompt
            });
            
            // Añadir mensajes previos si existen
            if (previousMessages.length > 0) {
              previousMessages.forEach((msg: any) => {
                openaiMessages.push({
                  role: msg.role === 'model' ? 'assistant' : msg.role, 
                  content: msg.content
                });
              });
            }
            
            // Añadir el mensaje actual
            openaiMessages.push({
              role: "user",
              content: message.body || ""
            });
            
            // Realizar la solicitud a OpenAI
            const completion = await this.openaiClient.chat.completions.create({
              model: "gpt-4o", // el modelo más reciente de OpenAI es "gpt-4o" que fue lanzado el 13 de mayo de 2024
              messages: openaiMessages as any,
              temperature: this.config.customPrompts.temperature,
              max_tokens: this.config.customPrompts.maxTokens,
            });
            
            responseText = completion.choices[0].message.content || "";
            
          } else if (this.geminiClient) {
            // Usar Gemini con prompt personalizado para generar la respuesta
            console.log("Usando Gemini para la respuesta automática");
            const model = this.geminiClient.getGenerativeModel({
              model: "gemini-pro",
              generationConfig: {
                temperature: this.config.customPrompts.temperature,
                maxOutputTokens: this.config.customPrompts.maxTokens,
                topP: 0.8,
                topK: 40
              }
            });
            
            // Preparar contexto con mensajes previos (si hay)
            let chat;
            if (previousMessages.length > 0) {
              // Iniciar chat con historial y el mensaje del sistema
              chat = model.startChat({
                history: [
                  { role: "user", parts: [{ text: "Hola" }] },
                  { role: "model", parts: [{ text: `Hola ${contactName}, ¿en qué puedo ayudarte hoy?` }] },
                  ...previousMessages.map((msg: any) => ({
                    role: msg.role,
                    parts: [{ text: msg.content }]
                  }))
                ],
                generationConfig: {
                  temperature: this.config.customPrompts.temperature,
                  maxOutputTokens: this.config.customPrompts.maxTokens
                }
              });
            } else {
              // Iniciar chat nuevo solo con el mensaje del sistema
              chat = model.startChat({
                history: [
                  { role: "user", parts: [{ text: "Instrucciones para asistente" }] },
                  { role: "model", parts: [{ text: systemPrompt }] }
                ],
                generationConfig: {
                  temperature: this.config.customPrompts.temperature,
                  maxOutputTokens: this.config.customPrompts.maxTokens
                }
              });
            }
            
            // Enviar el mensaje actual
            const result = await chat.sendMessage(message.body || "");
            responseText = result.response.text();
          }
          
          // Aplicar nivel de profesionalidad si está habilitado
          if (this.config.useProfessionLevel) {
            try {
              const { storage } = await import('../storage');
              const settings = await storage.getGeminiSettings();
              responseText = await this.adjustToneWithGemini(responseText, settings?.professionLevel || 'professional');
            } catch (err) {
              console.error('Error al ajustar tono con Gemini:', err);
            }
          }
          
        } catch (err) {
          console.error('Error al generar respuesta con IA:', err);
          // Si falla, caer en el método tradicional
          responseText = template.template.replace(/{{nombre}}/g, contactName);
        }
      } else {
        // Método tradicional: usar plantilla predefinida
        responseText = template.template;
        
        // Reemplazar variables en la plantilla
        responseText = responseText.replace(/{{nombre}}/g, contactName);
        
        // Si se usa nivel de profesionalidad, ajustar el tono con Gemini
        if (this.config.useProfessionLevel && this.geminiClient) {
          try {
            // Importar el servicio de almacenamiento bajo demanda
            const { storage } = await import('../storage');
            
            // Obtener nivel de profesionalidad
            const settings = await storage.getGeminiSettings();
            responseText = await this.adjustToneWithGemini(responseText, settings?.professionLevel || 'professional');
          } catch (err) {
            console.error('Error al ajustar tono con Gemini:', err);
          }
        }
      }
      
      // Enviar el mensaje
      try {
        // Importar el servicio de almacenamiento bajo demanda
        const { storage } = await import('../storage');
        
        // Enviar mensaje
        await storage.sendWhatsAppMessage(message.from, responseText);
        
        // Registrar la actividad
        await storage.logAutoResponse({
          contactId: message.from,
          messageId: message.id,
          templateId: template.id,
          sentAt: new Date(),
          responseText
        });
      } catch (error) {
        console.error('Error al enviar respuesta automática:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error al enviar respuesta automática:', error);
      throw error;
    }
  }

  /**
   * Ajusta el tono del mensaje según el nivel de profesionalidad actual
   */
  private async adjustToneWithGemini(text: string, professionLevel: string): Promise<string> {
    if (!this.geminiClient) return text;
    
    try {
      // Si el nivel es profesional, no es necesario ajustar
      if (professionLevel === 'professional') return text;
      
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
      
      // Crear el prompt para Gemini
      const prompt = `
        Reformula el siguiente texto en un tono "${professionLevel}" (puede ser casual, profesional, técnico o ejecutivo).
        Mantén el mismo significado y propósito, pero adapta el estilo y formalidad.
        
        Texto original: "${text}"
        
        Reformulación:
      `;
      
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();
      
      return response || text; // Si hay algún error, devolver el texto original
    } catch (error) {
      console.error('Error al ajustar tono con Gemini:', error);
      return text;
    }
  }
}

// Instancia singleton del servicio
export const autoResponseService = new AutoResponseService();
