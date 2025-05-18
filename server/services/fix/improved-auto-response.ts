import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { GeminiV1Client } from '../geminiV1';
import { getGeminiApiKey, getOpenAIApiKey } from '../aiKeysManager';
import { MessageMedia } from 'whatsapp-web.js';

// Tipo de datos para la plantilla de respuesta automática
interface ResponseTemplate {
  id: string;
  name: string;
  pattern?: string;
  template: string;
  autoDetect: boolean;
  triggerWords?: string[];
  type?: string;
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
  aiProvider: "gemini" | "openai";
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
  delaySeconds: 1,
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
      template: "Hola, en este momento estamos fuera de horario de atención. Si es una emergencia, por favor contacta al siguiente número: [NÚMERO DE EMERGENCIA]",
      autoDetect: false
    },
    {
      id: "sales",
      name: "Ventas",
      pattern: "comprar|precio|costo|adquirir",
      template: "Gracias por tu interés en nuestros productos. Un asesor de ventas te contactará a la brevedad para brindarte toda la información que necesitas.",
      autoDetect: true
    }
  ],
  useProfessionLevel: true,
  defaultTemplate: "default",
  enabledForGroups: false,
  enabledForBroadcast: false,
  excludedContacts: [],
  aiProvider: "gemini",
  customPrompts: {
    enabled: true,
    system: "Eres un asistente profesional que representa a una empresa. Responde de manera cordial, clara y concisa. Recuerda saludar llamando a la persona por su nombre si está disponible. No inventes información. Si no sabes algo, simplemente indica que consultarás con el equipo y te pondrás en contacto.",
    temperature: 0.7,
    maxTokens: 300
  }
};

/**
 * Clase que implementa el servicio de respuestas automáticas
 */
export class AutoResponseService {
  private static instance: AutoResponseService;
  private config: AutoResponseConfig;
  private configFile: string;
  private configDir: string;
  private geminiClient: any = null;
  private openaiClient: OpenAI | null = null;
  private geminiV1Client: GeminiV1Client | null = null;
  private lastResponses: Map<string, number> = new Map();
  private whatsappService: any = null;
  private isInitialized: boolean = false;
  private debugMode: boolean = true;

  /**
   * Constructor privado para patrón Singleton
   */
  private constructor() {
    this.configDir = path.join(process.cwd(), 'config');
    this.configFile = path.join(this.configDir, 'auto-response.json');
    this.config = this.loadConfig();
    this.debugLog('Servicio de respuestas automáticas inicializado.');
  }

  /**
   * Obtener la instancia del servicio
   */
  public static getInstance(): AutoResponseService {
    if (!AutoResponseService.instance) {
      AutoResponseService.instance = new AutoResponseService();
    }
    return AutoResponseService.instance;
  }

  /**
   * Inicializa los servicios de IA
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }
      
      this.debugLog('Inicializando servicios de IA...');

      // Inicializar cliente de OpenAI
      const openaiApiKey = await getOpenAIApiKey();
      if (openaiApiKey) {
        try {
          this.openaiClient = new OpenAI({
            apiKey: openaiApiKey
          });
          this.debugLog('Cliente OpenAI inicializado correctamente');
        } catch (error) {
          this.debugLog(`Error al inicializar OpenAI: ${error}`);
        }
      } else {
        this.debugLog('No se pudo inicializar OpenAI: falta API key');
      }

      // Inicializar cliente de Gemini
      try {
        this.geminiV1Client = new GeminiV1Client();
        this.debugLog('Cliente GeminiV1 inicializado correctamente');
      } catch (error) {
        this.debugLog(`Error al inicializar GeminiV1: ${error}`);
      }

      this.isInitialized = true;
      this.debugLog('Servicios de IA inicializados correctamente');
    } catch (error) {
      this.debugLog(`Error en la inicialización: ${error}`);
      throw error;
    }
  }

  /**
   * Carga la configuración desde el archivo o usa la predeterminada
   */
  private loadConfig(): AutoResponseConfig {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      if (fs.existsSync(this.configFile)) {
        const configData = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(configData);
      } else {
        this.saveConfig(defaultConfig);
        return defaultConfig;
      }
    } catch (error) {
      this.debugLog(`Error al cargar configuración: ${error}`);
      return defaultConfig;
    }
  }

  /**
   * Guarda la configuración en el archivo
   */
  private saveConfig(config: AutoResponseConfig): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      this.debugLog(`Error al guardar configuración: ${error}`);
    }
  }

  /**
   * Obtiene la configuración actual
   */
  public getConfig(): AutoResponseConfig {
    return this.config;
  }

  /**
   * Actualiza la configuración
   */
  public updateConfig(newConfig: Partial<AutoResponseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig(this.config);
    this.debugLog('Configuración actualizada');
  }

  /**
   * Procesa un mensaje entrante y envía una respuesta automática si corresponde
   */
  public async processIncomingMessage(message: any): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Verificar si el servicio está habilitado
      if (!this.config.enabled) {
        this.debugLog('Servicio de respuestas automáticas deshabilitado');
        return;
      }

      // Ignorar mensajes propios
      if (message.fromMe) {
        return;
      }

      // Obtener información del chat
      const chatId = message.from;
      const isGroup = chatId.endsWith('@g.us');
      const isBroadcast = chatId === 'status@broadcast';

      // Verificar si está habilitado para grupos o broadcast
      if ((isGroup && !this.config.enabledForGroups) || 
          (isBroadcast && !this.config.enabledForBroadcast)) {
        return;
      }

      // Verificar si el contacto está excluido
      if (this.config.excludedContacts.includes(chatId)) {
        this.debugLog(`Contacto excluido: ${chatId}`);
        return;
      }

      // Verificar tiempo desde la última respuesta
      const now = Date.now();
      const lastResponseTime = this.lastResponses.get(chatId) || 0;
      if (now - lastResponseTime < this.config.delaySeconds * 1000) {
        this.debugLog(`Respuesta retrasada para ${chatId} debido al tiempo mínimo entre respuestas`);
        return;
      }

      // Obtener servicio de WhatsApp bajo demanda
      if (!this.whatsappService) {
        try {
          // Importar dinámicamente para evitar dependencias circulares
          const { whatsappService } = await import('../whatsappServiceImpl');
          this.whatsappService = whatsappService;
        } catch (error) {
          this.debugLog(`Error al cargar servicio WhatsApp: ${error}`);
          return;
        }
      }

      // Procesar mensaje y determinar plantilla a usar
      this.debugLog(`Procesando mensaje de ${chatId}: ${message.body}`);
      
      // Obtener información del contacto para personalizar respuesta
      let contactName = "cliente";
      try {
        const contact = await message.getContact();
        contactName = contact.name || contact.pushname || contactName;
      } catch (error) {
        this.debugLog(`Error al obtener contacto: ${error}`);
      }

      // Seleccionar plantilla basada en patrones y configuración
      const selectedTemplate = await this.selectTemplate(message.body);
      if (!selectedTemplate) {
        this.debugLog(`No se encontró plantilla apropiada para ${chatId}`);
        return;
      }

      this.debugLog(`Plantilla seleccionada para ${chatId}: ${selectedTemplate.name}`);

      // Generar respuesta personalizada
      let responseText = "";
      
      if (this.config.customPrompts.enabled) {
        // Usar IA para generar respuesta personalizada
        responseText = await this.generateAIResponse(message.body, contactName);
      } else {
        // Usar plantilla predefinida
        responseText = selectedTemplate.template.replace(/{{nombre}}/g, contactName);
      }

      if (!responseText || responseText.trim() === "") {
        this.debugLog(`Respuesta vacía generada para ${chatId}, usando plantilla predeterminada`);
        const defaultTemplate = this.config.templates.find(t => t.id === this.config.defaultTemplate) || this.config.templates[0];
        responseText = defaultTemplate.template.replace(/{{nombre}}/g, contactName);
      }

      // Ajustar tono según nivel profesional si está habilitado
      if (this.config.useProfessionLevel && responseText) {
        try {
          const adjustedText = await this.adjustTone(responseText);
          if (adjustedText && adjustedText.trim() !== "") {
            responseText = adjustedText;
          }
        } catch (error) {
          this.debugLog(`Error al ajustar tono: ${error}`);
        }
      }

      // Enviar respuesta con retraso configurado
      setTimeout(async () => {
        try {
          this.debugLog(`Enviando respuesta a ${chatId}`);
          await this.whatsappService.sendMessage(chatId, responseText);
          
          // Actualizar el tiempo de la última respuesta
          this.lastResponses.set(chatId, Date.now());
          this.debugLog(`Respuesta enviada a ${chatId}`);
        } catch (error) {
          this.debugLog(`Error al enviar respuesta a ${chatId}: ${error}`);
        }
      }, this.config.delaySeconds * 1000);

    } catch (error) {
      this.debugLog(`Error al procesar mensaje: ${error}`);
    }
  }

  /**
   * Selecciona la plantilla más apropiada basada en el contenido del mensaje
   */
  private async selectTemplate(messageText: string): Promise<ResponseTemplate | null> {
    // Empezar con la plantilla predeterminada
    let defaultTemplate = this.config.templates.find(t => t.id === this.config.defaultTemplate);
    if (!defaultTemplate && this.config.templates.length > 0) {
      defaultTemplate = this.config.templates[0];
    }

    if (!messageText || messageText.trim() === "") {
      return defaultTemplate;
    }

    // Buscar plantillas basadas en patrones explícitos
    for (const template of this.config.templates) {
      if (template.pattern) {
        const regex = new RegExp(template.pattern, 'i');
        if (regex.test(messageText)) {
          return template;
        }
      }
    }

    // Usar IA para determinar la mejor plantilla si hay alguna autoDetect
    const autoDetectTemplates = this.config.templates.filter(t => t.autoDetect);
    if (autoDetectTemplates.length > 0) {
      const aiTemplate = await this.selectTemplateWithAI(messageText, autoDetectTemplates);
      if (aiTemplate) {
        return aiTemplate;
      }
    }

    // Si no hay coincidencias, devolver la plantilla predeterminada
    return defaultTemplate;
  }

  /**
   * Usa IA para seleccionar la mejor plantilla
   */
  private async selectTemplateWithAI(messageText: string, templates: ResponseTemplate[]): Promise<ResponseTemplate | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const prompt = `
        Analiza el siguiente mensaje y elige la mejor plantilla de respuesta basada en su contenido.
        
        Mensaje: "${messageText}"
        
        Opciones de plantillas:
        ${templates.map((t, i) => `${i + 1}. ${t.name}: ${t.template}`).join('\n')}
        
        Responde solamente con el número de la mejor opción (1, 2, 3, etc.).
      `;

      let result: string | null = null;
      
      // Primero intentar con el proveedor configurado
      if (this.config.aiProvider === "openai" && this.openaiClient) {
        try {
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 10
          });
          
          result = response.choices[0].message.content || '';
        } catch (error) {
          this.debugLog(`Error con OpenAI: ${error}`);
        }
      } else if (this.geminiV1Client) {
        try {
          result = await this.geminiV1Client.generateContent(prompt);
        } catch (error) {
          this.debugLog(`Error con Gemini: ${error}`);
        }
      }

      // Probar con el proveedor alternativo si falló el primero
      if (!result && this.config.aiProvider === "gemini" && this.openaiClient) {
        try {
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 10
          });
          
          result = response.choices[0].message.content || '';
        } catch (error) {
          this.debugLog(`Error con OpenAI alternativo: ${error}`);
        }
      } else if (!result && this.config.aiProvider === "openai" && this.geminiV1Client) {
        try {
          result = await this.geminiV1Client.generateContent(prompt);
        } catch (error) {
          this.debugLog(`Error con Gemini alternativo: ${error}`);
        }
      }

      if (result) {
        // Extraer el número de la respuesta
        const match = result.match(/\d+/);
        if (match) {
          const templateIndex = parseInt(match[0]) - 1;
          if (templateIndex >= 0 && templateIndex < templates.length) {
            return templates[templateIndex];
          }
        }
      }
    } catch (error) {
      this.debugLog(`Error al seleccionar plantilla con IA: ${error}`);
    }

    return null;
  }

  /**
   * Genera una respuesta usando IA
   */
  private async generateAIResponse(messageText: string, contactName: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const systemPrompt = this.config.customPrompts.system.replace(/{{nombre}}/g, contactName);
      
      let result: string | null = null;
      
      // Primero intentar con el proveedor configurado
      if (this.config.aiProvider === "openai" && this.openaiClient) {
        try {
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: messageText }
            ],
            temperature: this.config.customPrompts.temperature,
            max_tokens: this.config.customPrompts.maxTokens
          });
          
          result = response.choices[0].message.content || '';
        } catch (error) {
          this.debugLog(`Error con OpenAI: ${error}`);
        }
      } else if (this.geminiV1Client) {
        try {
          const prompt = `${systemPrompt}\n\nCliente: ${messageText}\n\nAsistente:`;
          result = await this.geminiV1Client.generateContent(
            prompt,
            "gemini-pro",
            {
              temperature: this.config.customPrompts.temperature,
              maxOutputTokens: this.config.customPrompts.maxTokens,
              topP: 0.8,
              topK: 40
            }
          );
        } catch (error) {
          this.debugLog(`Error con Gemini: ${error}`);
        }
      }

      // Probar con el proveedor alternativo si falló el primero
      if (!result && this.config.aiProvider === "gemini" && this.openaiClient) {
        try {
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: messageText }
            ],
            temperature: this.config.customPrompts.temperature,
            max_tokens: this.config.customPrompts.maxTokens
          });
          
          result = response.choices[0].message.content || '';
        } catch (error) {
          this.debugLog(`Error con OpenAI alternativo: ${error}`);
        }
      } else if (!result && this.config.aiProvider === "openai" && this.geminiV1Client) {
        try {
          const prompt = `${systemPrompt}\n\nCliente: ${messageText}\n\nAsistente:`;
          result = await this.geminiV1Client.generateContent(
            prompt,
            "gemini-pro",
            {
              temperature: this.config.customPrompts.temperature,
              maxOutputTokens: this.config.customPrompts.maxTokens,
              topP: 0.8,
              topK: 40
            }
          );
        } catch (error) {
          this.debugLog(`Error con Gemini alternativo: ${error}`);
        }
      }

      return result || "No fue posible generar una respuesta personalizada. Un asesor te contactará pronto.";

    } catch (error) {
      this.debugLog(`Error al generar respuesta con IA: ${error}`);
      return "Lo siento, estamos experimentando dificultades técnicas. Un asesor te contactará pronto.";
    }
  }

  /**
   * Ajusta el tono de la respuesta
   */
  private async adjustTone(text: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!text || text.trim() === "") {
      return text;
    }

    try {
      const prompt = `
        Ajusta el siguiente texto para que tenga un tono profesional y amigable.
        Mantén la misma información pero mejora la presentación.
        
        Texto original: "${text}"
        
        Texto ajustado:
      `;
      
      let result: string | null = null;
      
      // Intentar con Gemini primero ya que es más económico
      if (this.geminiV1Client) {
        try {
          result = await this.geminiV1Client.generateContent(prompt);
        } catch (error) {
          this.debugLog(`Error ajustando tono con Gemini: ${error}`);
        }
      }
      
      // Si Gemini falla, intentar con OpenAI
      if (!result && this.openaiClient) {
        try {
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 200
          });
          
          result = response.choices[0].message.content || '';
        } catch (error) {
          this.debugLog(`Error ajustando tono con OpenAI: ${error}`);
        }
      }
      
      return result || text;

    } catch (error) {
      this.debugLog(`Error al ajustar tono: ${error}`);
      return text;
    }
  }

  /**
   * Agrega un contacto a la lista de excluidos
   */
  public excludeContact(chatId: string): void {
    if (!this.config.excludedContacts.includes(chatId)) {
      this.config.excludedContacts.push(chatId);
      this.saveConfig(this.config);
      this.debugLog(`Contacto ${chatId} excluido de respuestas automáticas`);
    }
  }

  /**
   * Elimina un contacto de la lista de excluidos
   */
  public includeContact(chatId: string): void {
    const index = this.config.excludedContacts.indexOf(chatId);
    if (index !== -1) {
      this.config.excludedContacts.splice(index, 1);
      this.saveConfig(this.config);
      this.debugLog(`Contacto ${chatId} incluido en respuestas automáticas`);
    }
  }

  /**
   * Log de depuración
   */
  private debugLog(message: string): void {
    if (this.debugMode) {
      console.log(`[AutoResponse] ${message}`);
    }
  }
}

// Exportar instancia singleton
export const autoResponseService = AutoResponseService.getInstance();