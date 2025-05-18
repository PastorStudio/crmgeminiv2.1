import { GeminiV1Client } from './geminiV1';
import OpenAI from 'openai';
import { getDb } from '../db';
import { ResponseTemplate } from '../types/autoResponse';
import winston from 'winston';

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'auto-response.log' })
  ]
});

/**
 * Servicio para gestionar respuestas automáticas usando IA
 */
export class AutoResponseService {
  private static instance: AutoResponseService;
  private config: any = {
    enabled: false,
    aiProvider: "gemini", // o "openai"
    customPrompts: {
      enabled: true,
      system: "Eres un asistente profesional que representa a una empresa. Responde de manera cordial, clara y concisa. Recuerda saludar llamando a la persona por su nombre si está disponible. No inventes información. Si no sabes algo, simplemente indica que consultarás con el equipo y te pondrás en contacto.",
      temperature: 0.7,
      maxTokens: 300
    },
    triggerWords: [],
    autoDetectIntent: true,
    excludedChats: [],
    excludedKeywords: []
  };
  
  private isInitialized: boolean = false;
  private openaiClient: OpenAI | null = null;
  private geminiV1Client: GeminiV1Client | null = null;
  
  /**
   * Constructor privado para garantizar el patrón Singleton
   */
  private constructor() {}
  
  /**
   * Obtener instancia única del servicio
   */
  public static getInstance(): AutoResponseService {
    if (!AutoResponseService.instance) {
      AutoResponseService.instance = new AutoResponseService();
    }
    return AutoResponseService.instance;
  }
  
  /**
   * Inicializar el servicio de respuestas automáticas
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Inicializando servicio de respuestas automáticas...');
      
      // Cargar configuración desde la base de datos
      const db = getDb();
      const [config] = await db.query(
        'SELECT * FROM auto_response_config ORDER BY id DESC LIMIT 1'
      );
      
      if (config && config.length > 0) {
        this.config = {
          enabled: config[0].enabled,
          aiProvider: config[0].ai_provider || "gemini",
          customPrompts: {
            enabled: config[0].custom_prompts_enabled,
            system: config[0].system_prompt || this.config.customPrompts.system,
            temperature: config[0].temperature || 0.7,
            maxTokens: config[0].max_tokens || 300
          },
          triggerWords: config[0].trigger_words ? config[0].trigger_words.split(',').map((w: string) => w.trim()) : [],
          autoDetectIntent: config[0].auto_detect_intent,
          excludedChats: config[0].excluded_chats ? config[0].excluded_chats.split(',').map((c: string) => c.trim()) : [],
          excludedKeywords: config[0].excluded_keywords ? config[0].excluded_keywords.split(',').map((k: string) => k.trim()) : []
        };
        logger.info(`Configuración cargada: ${JSON.stringify(this.config)}`);
      } else {
        // Crear configuración por defecto si no existe
        await db.query(
          `INSERT INTO auto_response_config 
          (enabled, ai_provider, custom_prompts_enabled, system_prompt, temperature, max_tokens, 
          trigger_words, auto_detect_intent, excluded_chats, excluded_keywords) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            this.config.enabled, 
            this.config.aiProvider,
            this.config.customPrompts.enabled,
            this.config.customPrompts.system,
            this.config.customPrompts.temperature,
            this.config.customPrompts.maxTokens,
            this.config.triggerWords.join(','),
            this.config.autoDetectIntent ? 1 : 0,
            this.config.excludedChats.join(','),
            this.config.excludedKeywords.join(',')
          ]
        );
        logger.info('Configuración predeterminada creada en la base de datos');
      }
      
      // Inicializar clientes de IA
      if (process.env.OPENAI_API_KEY) {
        this.openaiClient = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY 
        });
        logger.info('Cliente OpenAI inicializado correctamente');
      } else {
        logger.warn('No se pudo inicializar OpenAI: falta OPENAI_API_KEY');
      }
      
      // Inicializar cliente de Gemini directamente desde archivo compartido
      try {
        this.geminiV1Client = new GeminiV1Client();
        logger.info('Cliente GeminiV1 inicializado correctamente');
      } catch (error) {
        logger.error(`Error al inicializar GeminiV1: ${error}`);
      }
      
      this.isInitialized = true;
      logger.info('Servicio de respuestas automáticas inicializado correctamente');
    } catch (error) {
      logger.error(`Error al inicializar el servicio de respuestas automáticas: ${error}`);
      throw error;
    }
  }
  
  /**
   * Actualiza la configuración del servicio
   */
  public async updateConfig(newConfig: any): Promise<void> {
    try {
      // Actualizar la configuración local
      this.config = {
        ...this.config,
        ...newConfig,
        customPrompts: {
          ...this.config.customPrompts,
          ...(newConfig.customPrompts || {})
        }
      };
      
      // Guardar en base de datos
      const db = getDb();
      await db.query(
        `INSERT INTO auto_response_config 
        (enabled, ai_provider, custom_prompts_enabled, system_prompt, temperature, max_tokens, 
        trigger_words, auto_detect_intent, excluded_chats, excluded_keywords) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.config.enabled, 
          this.config.aiProvider,
          this.config.customPrompts.enabled,
          this.config.customPrompts.system,
          this.config.customPrompts.temperature,
          this.config.customPrompts.maxTokens,
          this.config.triggerWords.join(','),
          this.config.autoDetectIntent ? 1 : 0,
          this.config.excludedChats.join(','),
          this.config.excludedKeywords.join(',')
        ]
      );
      
      logger.info(`Configuración actualizada: ${JSON.stringify(this.config)}`);
    } catch (error) {
      logger.error(`Error al actualizar configuración: ${error}`);
      throw error;
    }
  }
  
  /**
   * Obtiene la configuración actual
   */
  public getConfig(): any {
    return this.config;
  }
  
  /**
   * Procesa un mensaje entrante y determina si debe enviar una respuesta automática
   */
  public async processIncomingMessage(message: any): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Verificar si el servicio está habilitado
      if (!this.config.enabled) {
        logger.debug('Servicio de respuestas automáticas deshabilitado');
        return;
      }
      
      // Ignorar mensajes enviados por nosotros
      if (message.fromMe) {
        logger.debug('Ignorando mensaje propio');
        return;
      }
      
      // Verificar si el chat está excluido
      if (this.config.excludedChats.includes(message.from)) {
        logger.debug(`Chat ${message.from} excluido de respuestas automáticas`);
        return;
      }
      
      const messageText = message.body || "";
      
      // Verificar si el mensaje contiene palabras excluidas
      if (this.config.excludedKeywords.some((keyword: string) => 
          messageText.toLowerCase().includes(keyword.toLowerCase()))) {
        logger.debug(`Mensaje contiene palabras excluidas: ${messageText}`);
        return;
      }
      
      logger.info(`Procesando mensaje entrante: ${messageText.substring(0, 100)}...`);
      
      // Recuperar plantillas desde la base de datos
      const db = getDb();
      const [templates] = await db.query('SELECT * FROM response_templates WHERE active = 1');
      
      // Convertir a formato TypeScript
      const responseTemplates: ResponseTemplate[] = templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        template: t.template,
        triggerWords: t.trigger_words ? t.trigger_words.split(',').map((w: string) => w.trim()) : [],
        type: t.type || 'standard'
      }));
      
      // Añadir opción de respuesta generada por IA
      responseTemplates.push({
        id: "ai_response",
        name: "Respuesta de IA personalizada",
        template: "",
        triggerWords: [],
        type: 'ai'
      });
      
      // Determinar la plantilla a utilizar
      let templateToUse: ResponseTemplate | null = null;
      
      // 1. Verificar palabras clave
      if (this.config.triggerWords.length > 0) {
        if (this.config.triggerWords.some((word: string) => 
            messageText.toLowerCase().includes(word.toLowerCase()))) {
          templateToUse = await this.determineTemplateWithAI(messageText, responseTemplates);
          logger.info(`Palabra clave detectada, usando IA para seleccionar plantilla`);
        }
      }
      
      // 2. Verificar palabras clave específicas de plantillas
      if (!templateToUse) {
        for (const template of responseTemplates) {
          if (template.triggerWords && template.triggerWords.length > 0) {
            if (template.triggerWords.some((word: string) => 
                messageText.toLowerCase().includes(word.toLowerCase()))) {
              templateToUse = template;
              logger.info(`Usando plantilla "${template.name}" por palabra clave específica`);
              break;
            }
          }
        }
      }
      
      // 3. Auto-detectar intención si está habilitado
      if (!templateToUse && this.config.autoDetectIntent) {
        templateToUse = await this.determineTemplateWithAI(messageText, responseTemplates);
        logger.info(`Auto-detección de intención: ${templateToUse ? templateToUse.name : 'ninguna plantilla seleccionada'}`);
      }
      
      // 4. Si encontramos una plantilla adecuada, enviar respuesta
      if (templateToUse) {
        await this.sendAutoResponse(message, templateToUse);
      } else {
        logger.info(`No se envió respuesta automática para: ${messageText.substring(0, 50)}...`);
      }
    } catch (error) {
      logger.error(`Error procesando mensaje entrante: ${error}`);
    }
  }
  
  /**
   * Determina qué plantilla usar basándose en IA
   */
  private async determineTemplateWithAI(messageText: string, templates: ResponseTemplate[]): Promise<ResponseTemplate | null> {
    if (!templates || templates.length === 0) return null;
    
    // Verificar si tenemos algún cliente de IA disponible
    if (!this.geminiV1Client && !this.openaiClient) {
      logger.warn("No hay cliente de IA disponible para determinar plantilla");
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
          logger.info("Usando OpenAI para determinar plantilla");
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o", // el modelo más reciente de OpenAI
            messages: [{ role: "user", content: prompt }],
            temperature: 0, // Usamos temperatura baja para respuestas más deterministas
            max_tokens: 10, // Solo necesitamos un número
          });
          
          responseText = response.choices[0].message.content || "";
          logger.info(`Respuesta de OpenAI: ${responseText}`);
        } catch (error) {
          logger.error(`Error al determinar plantilla con OpenAI: ${error}`);
          // Si falla OpenAI, intentamos con Gemini
          if (this.geminiV1Client) {
            try {
              const geminiResponse = await this.geminiV1Client.generateContent(prompt);
              responseText = geminiResponse;
              logger.info(`Respuesta alternativa de Gemini: ${responseText}`);
            } catch (innerError) {
              logger.error(`Error al determinar plantilla con Gemini alternativo: ${innerError}`);
            }
          }
        }
      }
      // Usar Gemini en caso contrario
      else if (this.geminiV1Client) {
        try {
          logger.info("Usando Gemini para determinar plantilla");
          const response = await this.geminiV1Client.generateContent(prompt);
          responseText = response;
          logger.info(`Respuesta de Gemini: ${responseText}`);
        } catch (error) {
          logger.error(`Error al determinar plantilla con Gemini: ${error}`);
          // Si falla Gemini y tenemos OpenAI, intentar con OpenAI
          if (this.openaiClient) {
            try {
              const openaiResponse = await this.openaiClient.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: 0,
                max_tokens: 10,
              });
              
              responseText = openaiResponse.choices[0].message.content || "";
              logger.info(`Respuesta alternativa de OpenAI: ${responseText}`);
            } catch (innerError) {
              logger.error(`Error al determinar plantilla con OpenAI alternativo: ${innerError}`);
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
      logger.error(`Error general al determinar plantilla: ${error}`);
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
      logger.info(`Preparando respuesta automática para mensaje: ${message.body.substring(0, 50)}...`);
      
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
            logger.warn(`No se pudo obtener nombre de contacto: ${err}`);
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
              logger.info(`Contexto de mensajes previos cargado: ${previousMessages.length} mensajes`);
            }
          } catch (err) {
            logger.warn(`No se pudieron obtener mensajes previos: ${err}`);
          }
        } catch (err) {
          // En caso de error, usar el número como nombre
          contactName = message.from.split('@')[0];
          logger.warn(`Usando número como nombre de contacto: ${contactName}`);
        }
      }
      
      let responseText = '';
      
      // Decidir si usar IA generativa basada en prompts personalizados o la plantilla tradicional
      if (isAIResponse || this.config.customPrompts.enabled) {
        try {
          // Preparar el mensaje del sistema con el prompt personalizado
          const systemPrompt = this.config.customPrompts.system
            .replace(/{{nombre}}/g, contactName);
            
          // Determinar qué proveedor de IA usar
          if (this.config.aiProvider === "openai" && this.openaiClient) {
            // Usar OpenAI para generar la respuesta
            logger.info("Usando OpenAI para la respuesta automática");
            
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
              messages: openaiMessages,
              temperature: this.config.customPrompts.temperature,
              max_tokens: this.config.customPrompts.maxTokens,
            });
            
            responseText = completion.choices[0].message.content || "";
            
            // Verificar que la respuesta no esté vacía
            if (!responseText.trim()) {
              throw new Error("OpenAI devolvió una respuesta vacía");
            }
            
            logger.info(`Respuesta generada con OpenAI: ${responseText.substring(0, 50)}...`);
          } else if (this.geminiV1Client) {
            // Usar nuestro cliente directo a la API de Gemini v1
            logger.info("Usando GeminiV1 directo para la respuesta automática");
            
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
              
              // Verificar que la respuesta no esté vacía
              if (!responseText.trim()) {
                throw new Error("Gemini devolvió una respuesta vacía");
              }
              
              logger.info(`Respuesta de GeminiV1: ${responseText.substring(0, 50)}...`);
            } catch (error) {
              logger.error(`Error con GeminiV1: ${error}`);
              
              // Si fallamos con Gemini, intentar con OpenAI como respaldo
              if (this.openaiClient) {
                try {
                  logger.info("Intentando con OpenAI como respaldo tras fallo de Gemini");
                  const openaiMessages = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message.body || "" }
                  ];
                  
                  const completion = await this.openaiClient.chat.completions.create({
                    model: "gpt-4o",
                    messages: openaiMessages,
                    temperature: this.config.customPrompts.temperature,
                    max_tokens: this.config.customPrompts.maxTokens,
                  });
                  
                  responseText = completion.choices[0].message.content || "";
                  
                  if (!responseText.trim()) {
                    throw new Error("OpenAI de respaldo devolvió respuesta vacía");
                  }
                  
                  logger.info(`Respuesta de respaldo OpenAI: ${responseText.substring(0, 50)}...`);
                } catch (innerError) {
                  logger.error(`Error con OpenAI de respaldo: ${innerError}`);
                  // Si ambos fallan, usar respuesta predeterminada
                  responseText = "Lo siento, no puedo procesar tu mensaje en este momento. Un agente te atenderá pronto.";
                }
              } else {
                // Respuesta predeterminada si no hay OpenAI como respaldo
                responseText = "Lo siento, no puedo procesar tu mensaje en este momento. Un agente te atenderá pronto.";
              }
            }
          } else {
            // Si no hay servicios de IA disponibles, usar respuesta genérica
            logger.warn("No hay servicios de IA disponibles para generar respuesta");
            responseText = "Gracias por tu mensaje. Lo revisaremos pronto y te responderemos.";
          }
        } catch (error) {
          logger.error(`Error general generando respuesta con IA: ${error}`);
          responseText = "Gracias por tu mensaje. Un asesor te responderá a la brevedad.";
        }
      } else {
        // Usar plantilla tradicional
        responseText = template.template
          .replace(/{{nombre}}/g, contactName);
        logger.info(`Usando plantilla estática: ${template.name}`);
      }
      
      // Enviar la respuesta
      if (responseText && responseText.trim()) {
        // Importar servicio de WhatsApp bajo demanda
        const { whatsappService } = await import('./whatsappServiceImpl');
        
        // Enviar mensaje
        await whatsappService.sendMessage(message.from, responseText);
        
        // Registrar actividad
        const db = getDb();
        await db.query(
          `INSERT INTO auto_responses (chat_id, template_id, original_message, response, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [message.from, template.id, message.body, responseText]
        );
        
        logger.info(`Respuesta automática enviada a ${message.from}`);
      } else {
        logger.warn("No se envió respuesta automática: texto vacío");
      }
    } catch (error) {
      logger.error(`Error al enviar respuesta automática: ${error}`);
    }
  }
  
  /**
   * Cancela la respuesta automática para un chat específico
   */
  public async cancelAutoResponse(chatId: string): Promise<void> {
    try {
      // Añadir el chat a la lista de excluidos
      if (!this.config.excludedChats.includes(chatId)) {
        this.config.excludedChats.push(chatId);
        
        // Guardar la configuración actualizada
        await this.updateConfig(this.config);
        
        logger.info(`Respuestas automáticas canceladas para chat: ${chatId}`);
      }
    } catch (error) {
      logger.error(`Error al cancelar respuesta automática: ${error}`);
      throw error;
    }
  }
}

// Exportar como singleton
export const autoResponseService = AutoResponseService.getInstance();