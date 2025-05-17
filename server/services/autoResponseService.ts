import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiV1Client } from './geminiV1';
import { getGeminiApiKey, getOpenAIApiKey } from './aiKeysManager';

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
  aiProvider: "gemini" | "openai"; // Propiedad para seleccionar el proveedor de IA
  customPrompts: {
    enabled: boolean;
    system: string;
    temperature: number;
    maxTokens: number;
  };
}

// Configuración predeterminada
const defaultConfig: AutoResponseConfig = {
  enabled: true,
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
    enabled: true,
    system: "Eres un asistente virtual profesional de atención al cliente. Tu objetivo es proporcionar respuestas amables, útiles y profesionales. Cuando te dirijas al cliente, llámalo por su nombre si lo conoces. Tus respuestas deben ser claras, concisas y orientadas a resolver las dudas o problemas del cliente. Mantén un tono amigable pero profesional en todo momento.",
    temperature: 0.7,
    maxTokens: 500
  }
};

// Mapa para almacenar temporizadores de respuesta por contacto
const responseTimers: Map<string, NodeJS.Timeout> = new Map();

// Mapa para evitar respuestas duplicadas (mensajeId -> booleano)
const responseSent: Map<string, boolean> = new Map();

/**
 * Clase que gestiona las respuestas automáticas de WhatsApp utilizando IA
 */
export class AutoResponseService {
  private config: AutoResponseConfig;
  private geminiClient: GoogleGenerativeAI | null = null;
  private openaiClient: OpenAI | null = null;
  private geminiV1Client: GeminiV1Client | null = null;
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
    // Inicializar Gemini usando nuestro gestor de claves API
    try {
      const { key: geminiApiKey, isClientKey } = getGeminiApiKey();
      
      if (!geminiApiKey) {
        console.warn('GEMINI_API_KEY no está definida. Las funciones de IA de Gemini no estarán disponibles.');
      } else {
        // Advertir si estamos usando una clave de cliente
        if (isClientKey) {
          console.warn('ADVERTENCIA: Usando clave de cliente Gemini en el servidor.');
          console.warn('Esto puede causar errores 404 o problemas en las llamadas a la API.');
          console.warn('Se recomienda configurar una clave de servidor correcta para Gemini.');
        }
        
        // Inicializar ambos clientes - el oficial y nuestra implementación directa
        this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
        // La clase GeminiV1Client ahora maneja internamente la validación de la clave
        this.geminiV1Client = new GeminiV1Client(geminiApiKey);
        console.log('Clientes Gemini inicializados con soporte para v1');
      }
    } catch (error) {
      console.error('Error al inicializar el cliente de Gemini:', error);
    }

    // Inicializar OpenAI usando nuestro gestor de claves API
    try {
      const openaiApiKey = getOpenAIApiKey();
      
      if (!openaiApiKey) {
        console.warn('OPENAI_API_KEY no está definida. Las funciones de IA de OpenAI no estarán disponibles.');
      } else {
        this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
        console.log('Cliente OpenAI inicializado correctamente');
        
        // Verificar que la clave funciona haciendo una pequeña prueba
        this.testOpenAIConnection().catch(err => {
          console.warn('La clave de OpenAI parece estar configurada pero no funciona correctamente:', err.message);
        });
      }
    } catch (error) {
      console.error('Error al inicializar el cliente de OpenAI:', error);
    }
  }
  
  /**
   * Prueba la conexión a OpenAI para verificar que la clave funciona
   */
  private async testOpenAIConnection(): Promise<void> {
    if (!this.openaiClient) return;
    
    try {
      // Hacer una prueba muy simple con pocos tokens
      await this.openaiClient.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hola" }],
        max_tokens: 5
      });
      console.log('Conexión a OpenAI verificada correctamente');
    } catch (error) {
      console.error('Error al verificar la conexión a OpenAI:', error);
      throw error;
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
  updateConfig(newConfig: Partial<AutoResponseConfig>): AutoResponseConfig {
    // Validar configuración básica
    if (newConfig.enabled !== undefined && typeof newConfig.enabled !== 'boolean') {
      throw new Error('El campo enabled debe ser un booleano');
    }
    
    if (newConfig.delaySeconds !== undefined && typeof newConfig.delaySeconds !== 'number') {
      throw new Error('El campo delaySeconds debe ser un número');
    }
    
    if (newConfig.templates !== undefined && !Array.isArray(newConfig.templates)) {
      throw new Error('El campo templates debe ser un array');
    }

    // Asegurarse de que aiProvider tenga un valor válido
    if (newConfig.aiProvider !== undefined && 
        newConfig.aiProvider !== 'gemini' && 
        newConfig.aiProvider !== 'openai') {
      throw new Error('El proveedor de IA debe ser "gemini" o "openai"');
    }

    // Combinar la configuración actual con la nueva
    this.config = { 
      ...this.config, 
      ...newConfig,
      // Asegurar que customPrompts se mezcla correctamente
      customPrompts: {
        ...this.config.customPrompts,
        ...(newConfig.customPrompts || {})
      }
    };
    
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
    // Si los prompts personalizados están habilitados, ignoramos las plantillas
    // y retornamos una plantilla especial que indicará al sistema que use la IA generativa
    if (this.config.customPrompts.enabled) {
      console.log("Usando modo de respuesta con IA personalizada (saltando búsqueda de plantilla)");
      return {
        id: "ai_response",
        name: "Respuesta de IA personalizada",
        template: "", // El contenido será generado por la IA
        autoDetect: false
      };
    }
    
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
    
    // 2. Si hay plantillas con autoDetect, intentar usar IA para determinar la mejor
    const autoDetectTemplates = this.config.templates.filter(t => t.autoDetect);
    if (autoDetectTemplates.length > 0) {
      try {
        // Intentar usar nuestra implementación directa de Gemini v1
        if (this.geminiV1Client) {
          console.log("Usando GeminiV1 directo para determinar plantilla");
          
          // Construir un prompt que describa las plantillas disponibles
          let prompt = "Analiza el siguiente mensaje y selecciona la mejor plantilla de respuesta. ";
          prompt += "Responde únicamente con el número de la plantilla más adecuada (1, 2, 3, etc.).\n\n";
          prompt += "Mensaje del cliente: " + messageText + "\n\n";
          prompt += "Plantillas disponibles:\n";
          
          autoDetectTemplates.forEach((template, index) => {
            prompt += `${index + 1}. ${template.name}: "${template.template}"\n`;
          });
          
          try {
            const response = await this.geminiV1Client.generateContent(prompt);
            console.log("Respuesta de GeminiV1 para elección de plantilla:", response);
            
            // Extraer el número de la plantilla de la respuesta
            const match = response.match(/\d+/);
            if (match) {
              const templateIndex = parseInt(match[0]) - 1;
              if (templateIndex >= 0 && templateIndex < autoDetectTemplates.length) {
                return autoDetectTemplates[templateIndex];
              }
            }
          } catch (error) {
            console.error("Error usando GeminiV1 para determinar plantilla:", error);
          }
        }
        
        // Fallback al método tradicional
        if (this.geminiClient) {
          const bestTemplate = await this.determineTemplateWithAI(messageText, autoDetectTemplates);
          if (bestTemplate) {
            return bestTemplate;
          }
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
          // Si falla OpenAI, intentamos con Gemini
          if (this.geminiV1Client) {
            try {
              const geminiResponse = await this.geminiV1Client.generateContent(prompt);
              responseText = geminiResponse;
              console.log("Respuesta alternativa de Gemini:", responseText);
            } catch (innerError) {
              console.error("Error al determinar plantilla con Gemini alternativo:", innerError);
            }
          }
        }
      }
      // Usar Gemini en caso contrario
      else if (this.geminiV1Client) {
        try {
          console.log("Usando Gemini para determinar plantilla");
          const response = await this.geminiV1Client.generateContent(prompt);
          responseText = response;
          console.log("Respuesta de Gemini:", responseText);
        } catch (error) {
          console.error("Error al determinar plantilla con Gemini:", error);
          // Si falla Gemini y tenemos OpenAI, intentar con OpenAI
          if (this.openaiClient) {
            try {
              const openaiResponse = await this.openaiClient.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }] as any,
                temperature: 0,
                max_tokens: 10,
              });
              
              responseText = openaiResponse.choices[0].message.content || "";
              console.log("Respuesta alternativa de OpenAI:", responseText);
            } catch (innerError) {
              console.error("Error al determinar plantilla con OpenAI alternativo:", innerError);
            }
          }
        }
      }
      
      // Extraer el número de plantilla de la respuesta
      const match = responseText.match(/\d+/);
      if (match) {
        const templateIndex = parseInt(match[0]) - 1;
        if (templateIndex >= 0 && templateIndex < templates.length) {
          return templates[templateIndex];
        }
      }
    } catch (error) {
      console.error("Error general al determinar plantilla:", error);
    }
    
    // Si todo falla, devolver null para usar métodos alternativos
    return null;
  }

  /**
   * Envía una respuesta automática
   */
  private async sendAutoResponse(message: any, template: ResponseTemplate): Promise<void> {
    if (!template) return;
    
    // Si es una respuesta de IA personalizada, ignoramos la plantilla y usamos la IA directamente
    const isAIResponse = template.id === "ai_response";
    
    try {
      console.log('Preparando respuesta automática para mensaje:', message.body);
      
      // Obtener el nombre del contacto si está disponible
      let contactName = 'cliente';
      let previousMessages: Array<{role: string, content: string}> = [];
      
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
            
          } else if (this.geminiV1Client) {
            // Usar nuestro cliente directo a la API de Gemini v1
            console.log("Usando GeminiV1 directo para la respuesta automática");
            
            try {
              // Preparar el contexto con mensajes previos
              let promptText = `${systemPrompt}\n\n`;
              
              // Añadir conversación previa si existe
              if (previousMessages.length > 0) {
                promptText += "Conversación anterior:\n";
                previousMessages.forEach((msg: any) => {
                  if (msg.role === "user") {
                    promptText += `Cliente: ${msg.content}\n`;
                  } else {
                    promptText += `Asistente: ${msg.content}\n`;
                  }
                });
                promptText += "\n";
              }
              
              // Añadir el mensaje actual
              promptText += `Cliente: ${message.body || ""}\n\nAsistente:`;
              
              // Generar respuesta con nuestro cliente que accede directamente a la API v1
              responseText = await this.geminiV1Client.generateContent(
                promptText,
                "gemini-pro",
                {
                  temperature: this.config.customPrompts.temperature,
                  maxOutputTokens: this.config.customPrompts.maxTokens,
                  topP: 0.8,
                  topK: 40
                }
              );
              
              console.log("Respuesta de GeminiV1:", responseText);
            } catch (error) {
              console.error("Error generando respuesta con GeminiV1:", error);
              responseText = "Hola, gracias por tu mensaje. En breve nos pondremos en contacto contigo.";
            }
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
      console.error('Error general en envío de respuesta automática:', error);
      throw error;
    }
  }

  /**
   * Ajusta el tono del mensaje según el nivel de profesionalidad actual
   */
  private async adjustToneWithGemini(text: string, professionLevel: string): Promise<string> {
    // Si el texto está vacío o el nivel es profesional (que es el predeterminado), no ajustar
    if (!text || professionLevel === 'professional') {
      return text;
    }
    
    // Intentar primero con nuestro cliente personalizado para Gemini v1
    if (this.geminiV1Client) {
      try {
        console.log(`Ajustando tono a nivel: ${professionLevel} con GeminiV1Client`);
        
        // Crear prompt para ajustar el tono
        const prompt = `
        Reescribe el siguiente mensaje para que tenga un tono ${professionLevel}. 
        Mantén el mismo significado y la misma información, pero ajusta el tono.
        Si el tono ya es apropiado, simplemente devuelve el mismo texto.
        
        Original: ${text}
        
        Reescrito:
        `;
        
        // Generar respuesta con nuestro cliente
        const response = await this.geminiV1Client.generateContent(
          prompt,
          "gemini-pro",
          {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        );
        
        // Si tenemos respuesta, usarla. De lo contrario, devolver el texto original
        if (response && response.trim()) {
          console.log('Tono ajustado correctamente con GeminiV1Client');
          return response;
        } else {
          console.log('GeminiV1Client devolvió respuesta vacía, usando texto original');
          return text;
        }
      } catch (error) {
        console.error('Error al ajustar tono con GeminiV1Client:', error);
        // Continuar con el siguiente método si este falla
      }
    }
    
    // Intentar con el cliente oficial de Google como fallback
    if (this.geminiClient) {
      try {
        console.log(`Intentando ajustar tono con cliente oficial de Google Gemini`);
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
        
        const prompt = `
        Reformula el siguiente texto en un tono "${professionLevel}" (puede ser casual, profesional, técnico o ejecutivo).
        Mantén el mismo significado y propósito, pero adapta el estilo y formalidad.
        
        Texto original: "${text}"
        
        Reformulación:
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();
        
        if (responseText && responseText.trim()) {
          console.log('Tono ajustado correctamente con cliente oficial de Google');
          return responseText;
        }
      } catch (error) {
        console.error('Error en ajuste de tono con cliente oficial de Google:', error);
      }
    }
    
    // Si todo falla, devolver el texto original
    console.log('No se pudo ajustar el tono, usando texto original');
    return text;
  }
}

// Instancia singleton del servicio
export const autoResponseService = new AutoResponseService();