import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../storage";
import { apiKeyManager } from "./apiKeyManager";

/**
 * Servicio para manejar interacciones con la API de Google Gemini
 */
export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private simulationMode: boolean = false;
  
  private constructor() {
    this.initialize();
  }
  
  /**
   * Devuelve la instancia única del servicio
   */
  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }
  
  /**
   * Inicializa el servicio con la clave API de Gemini
   */
  private initialize(): void {
    try {
      // Intentar obtener la clave API
      const apiKey = apiKeyManager.getGeminiKey() || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        console.warn("GeminiService: No API key available, using simulation mode");
        this.simulationMode = true;
        return;
      }
      
      // Inicializar la API de Gemini
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      this.simulationMode = false;
      
      console.log("GeminiService initialized successfully");
    } catch (error) {
      console.error("Error initializing GeminiService:", error);
      this.simulationMode = true;
    }
  }
  
  /**
   * Verifica si el servicio está en modo simulación
   */
  public isSimulationMode(): boolean {
    return this.simulationMode;
  }
  
  /**
   * Reinicia el servicio para usar una nueva clave API
   */
  public reinitialize(): void {
    this.initialize();
  }
  
  /**
   * Genera contenido usando la API de Gemini
   * @param prompt El prompt para generar contenido
   * @returns El texto generado
   */
  public async generateContent(prompt: string): Promise<string> {
    try {
      if (this.simulationMode) {
        return this.simulateResponse(prompt);
      }
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return text;
    } catch (error) {
      console.error("Error generating content with Gemini:", error);
      return this.simulateResponse(prompt);
    }
  }
  
  /**
   * Chatea con Gemini usando un historial de conversación
   * @param prompt El mensaje del usuario
   * @param history Historial de mensajes previos (opcional)
   * @returns La respuesta de Gemini
   */
  public async chat(prompt: string, history: any[] = []): Promise<string> {
    try {
      if (this.simulationMode) {
        return this.simulateResponse(prompt);
      }
      
      // Convertir el historial al formato esperado por Gemini
      const chatHistory = history.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));
      
      // Crear una instancia de chat
      const chat = this.model.startChat({
        history: chatHistory,
      });
      
      // Enviar el mensaje y obtener la respuesta
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();
      
      return text;
    } catch (error) {
      console.error("Error in chat with Gemini:", error);
      return this.simulateResponse(prompt);
    }
  }
  
  /**
   * Genera un mensaje personalizado para un lead
   * @param leadId ID del lead
   * @param messageType Tipo de mensaje a generar
   * @returns Mensaje generado
   */
  public async generateMessage(leadId: number, messageType: string): Promise<string> {
    try {
      // Obtener datos del lead
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead with ID ${leadId} not found`);
      }
      
      // Definir contexto según el tipo de mensaje
      let contextPrompt = "";
      switch (messageType) {
        case "follow-up":
          contextPrompt = "Es un mensaje de seguimiento después de un primer contacto. Sé cordial pero profesional.";
          break;
        case "proposal":
          contextPrompt = "Es un mensaje para presentar una propuesta. Sé persuasivo destacando el valor para el cliente.";
          break;
        case "meeting":
          contextPrompt = "Es un mensaje para coordinar una reunión. Sé conciso y propón algunas fechas/horarios posibles.";
          break;
        default:
          contextPrompt = "Es un mensaje personalizado. Sé profesional y adaptado al contexto.";
      }
      
      // Construir el prompt para Gemini
      const prompt = `
        Eres un asistente de ventas profesional. 
        Genera un mensaje personalizado para un lead con las siguientes características:
        
        - Nombre: ${lead.fullName}
        - Correo: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado: ${lead.status || 'Nuevo lead'}
        
        ${contextPrompt}
        
        El tono debe ser profesional pero amigable. Incluye el nombre del lead en el saludo.
        No incluyas líneas de asunto. Limítate a crear el cuerpo del mensaje.
        Mantén una longitud moderada, entre 100-150 palabras.
      `;
      
      // Generar el mensaje
      return await this.generateContent(prompt);
    } catch (error) {
      console.error("Error generating message:", error);
      throw error;
    }
  }
  
  /**
   * Analiza la información de un lead usando Gemini
   * @param leadId ID del lead a analizar
   * @returns Análisis del lead
   */
  public async analyzeLead(leadId: number): Promise<string> {
    try {
      // Obtener datos del lead
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead with ID ${leadId} not found`);
      }
      
      // Obtener actividades recientes
      const activities = await storage.getActivitiesByLead(leadId);
      
      // Construir el prompt para Gemini
      const prompt = `
        Eres un analista de ventas experto. 
        Analiza el siguiente lead y proporciona insights valiosos para el equipo de ventas:
        
        - Nombre: ${lead.fullName}
        - Correo: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado: ${lead.status || 'Nuevo lead'}
        - Puntaje: ${lead.score !== null ? lead.score : 'No evaluado'}
        - Origen: ${lead.source || 'No especificado'}
        
        Actividades recientes:
        ${activities.length > 0 
          ? activities.map(a => `- ${a.type}: ${a.description} (${a.completed ? 'Completada' : 'Pendiente'})`).join('\n')
          : 'No hay actividades registradas.'
        }
        
        Proporciona un análisis integral que incluya:
        1. Evaluación del potencial del lead
        2. Recomendaciones para el seguimiento
        3. Posibles desafíos o objeciones a anticipar
        4. Próximos pasos sugeridos
        
        Sé específico y proporciona consejos accionables.
      `;
      
      // Generar el análisis
      return await this.generateContent(prompt);
    } catch (error) {
      console.error("Error analyzing lead:", error);
      throw error;
    }
  }
  
  /**
   * Sugiere una acción específica para avanzar con un lead
   * @param leadId ID del lead
   * @returns Sugerencia de acción
   */
  public async suggestAction(leadId: number): Promise<string> {
    try {
      // Obtener datos del lead
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead with ID ${leadId} not found`);
      }
      
      // Obtener actividades y mensajes recientes
      const activities = await storage.getActivitiesByLead(leadId);
      const messages = await storage.getMessagesByLead(leadId);
      
      // Construir el prompt para Gemini
      const prompt = `
        Eres un asesor de ventas estratégico.
        Sugiere una acción específica y concreta para avanzar con el siguiente lead:
        
        - Nombre: ${lead.fullName}
        - Correo: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado: ${lead.status || 'Nuevo lead'}
        - Puntaje: ${lead.score !== null ? lead.score : 'No evaluado'}
        - Origen: ${lead.source || 'No especificado'}
        
        Actividades recientes:
        ${activities.length > 0 
          ? activities.map(a => `- ${a.type}: ${a.description} (${a.completed ? 'Completada' : 'Pendiente'})`).join('\n')
          : 'No hay actividades registradas.'
        }
        
        Mensajes recientes:
        ${messages.length > 0
          ? messages.slice(0, 3).map(m => `- ${m.sentAt}: ${m.content.substring(0, 100)}...`).join('\n')
          : 'No hay mensajes registrados.'
        }
        
        Proporciona UNA SOLA acción específica, concreta y altamente efectiva que el agente de ventas debería tomar ahora mismo.
        La acción debe ser:
        - Específica y accionable hoy mismo
        - Orientada a resultados
        - Adaptada al contexto específico del lead
        - Explicada con los pasos necesarios para implementarla
        
        Responde en un párrafo conciso (máximo 120 palabras).
      `;
      
      // Generar la sugerencia de acción
      return await this.generateContent(prompt);
    } catch (error) {
      console.error("Error suggesting action:", error);
      throw error;
    }
  }
  
  /**
   * Extrae y actualiza información de leads basada en una conversación
   * @param leadId ID del lead
   * @param conversation Texto de la conversación
   * @returns Datos actualizados del lead
   */
  public async extractLeadInfoFromConversation(leadId: number, conversation: string): Promise<any> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead with ID ${leadId} not found`);
      }
      
      // Crear prompt para extraer información
      const prompt = `
        Eres un asistente especializado en la extracción de información.
        Analiza la siguiente conversación con un lead y extrae cualquier información relevante 
        que podría usarse para actualizar su perfil, como:
        - Correo electrónico
        - Número de teléfono
        - Nombre de empresa
        - Cargo o posición
        - Intereses específicos mencionados
        - Necesidades o problemas expresados
        - Presupuesto o rango de precios mencionados
        - Plazos o fechas importantes
        
        Conversación:
        "${conversation}"
        
        Información actual del lead:
        - Nombre: ${lead.fullName}
        - Correo: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        
        Devuelve solo un objeto JSON con los campos actualizables y la información extraída, 
        sin ningún texto adicional. Incluye solo los campos donde se encontró información nueva 
        o diferente a la existente. El formato debe ser:
        {
          "updates": {
            "email": "nuevo@email.com",
            "phone": "123456789",
            ...
          },
          "interests": [
            {"topic": "tema de interés", "confidence": 85},
            ...
          ],
          "needs": [
            {"need": "necesidad identificada", "priority": "alta/media/baja"}
            ...
          ]
        }
      `;
      
      // Generar análisis
      const response = await this.generateContent(prompt);
      
      // Intentar extraer el JSON de la respuesta
      try {
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) {
          throw new Error('No se pudo encontrar un objeto JSON en la respuesta');
        }
        
        const jsonStr = jsonMatch[0];
        const extractedData = JSON.parse(jsonStr);
        
        // Si hay actualizaciones, las aplicamos al lead
        if (extractedData.updates && Object.keys(extractedData.updates).length > 0) {
          // Actualizar el lead con la información extraída
          const updatedLead = await storage.updateLead(leadId, extractedData.updates);
          
          // Si hay intereses, los agregamos
          if (extractedData.interests && extractedData.interests.length > 0) {
            // Asumimos que hay un campo de intereses en el lead (lo añadimos en el schema)
            const interests = extractedData.interests.map((interest: any) => ({
              topic: interest.topic,
              confidence: interest.confidence || 50
            }));
            
            await storage.updateLead(leadId, {
              interests: JSON.stringify(interests)
            });
          }
          
          return {
            success: true,
            updatedLead,
            extractedData
          };
        }
        
        return {
          success: true,
          message: "No se encontró información nueva para actualizar",
          extractedData
        };
      } catch (error) {
        console.error("Error parsing extracted data:", error);
        return {
          success: false,
          message: "Error al analizar la información extraída",
          error: (error as Error).message
        };
      }
    } catch (error) {
      console.error("Error extracting lead info from conversation:", error);
      throw error;
    }
  }
  
  /**
   * Genera etiquetas con porcentajes de probabilidad para un lead
   * @param leadId ID del lead
   * @returns Etiquetas con probabilidades
   */
  public async generateTagsWithProbability(leadId: number): Promise<any> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead with ID ${leadId} not found`);
      }
      
      // Obtener actividades y mensajes para contexto
      const activities = await storage.getActivitiesByLead(leadId);
      const messages = await storage.getMessagesByLead(leadId);
      
      // Construir el prompt para Gemini
      const prompt = `
        Eres un analista de datos especializado en CRM y ventas.
        Basado en la siguiente información de un lead, genera 5-7 etiquetas relevantes con 
        porcentajes de probabilidad que reflejen características, intereses potenciales, 
        y la calidad general del lead.
        
        - Nombre: ${lead.fullName}
        - Correo: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado: ${lead.status || 'Nuevo lead'}
        - Puntaje: ${lead.score !== null ? lead.score : 'No evaluado'}
        - Origen: ${lead.source || 'No especificado'}
        
        Actividades recientes:
        ${activities.length > 0 
          ? activities.map(a => `- ${a.type}: ${a.description} (${a.completed ? 'Completada' : 'Pendiente'})`).join('\n')
          : 'No hay actividades registradas.'
        }
        
        Mensajes recientes:
        ${messages.length > 0
          ? messages.slice(0, 3).map(m => `- ${m.sentAt}: ${m.content.substring(0, 100)}...`).join('\n')
          : 'No hay mensajes registrados.'
        }
        
        Devuelve solo un objeto JSON con las etiquetas y sus probabilidades, sin texto adicional.
        Cada etiqueta debe incluir un nombre descriptivo, un porcentaje de probabilidad (1-100),
        y una categoría. El formato debe ser:
        
        {
          "tags": [
            {"name": "nombre de la etiqueta", "probability": 85, "category": "interés/característica/calidad"},
            ...
          ]
        }
      `;
      
      // Generar etiquetas
      const response = await this.generateContent(prompt);
      
      // Intentar extraer el JSON de la respuesta
      try {
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) {
          throw new Error('No se pudo encontrar un objeto JSON en la respuesta');
        }
        
        const jsonStr = jsonMatch[0];
        const tagsData = JSON.parse(jsonStr);
        
        // Actualizar el lead con las etiquetas generadas
        if (tagsData.tags && tagsData.tags.length > 0) {
          await storage.updateLead(leadId, {
            tags: JSON.stringify(tagsData.tags)
          });
          
          return {
            success: true,
            tags: tagsData.tags
          };
        }
        
        return {
          success: false,
          message: "No se pudieron generar etiquetas"
        };
      } catch (error) {
        console.error("Error parsing tags data:", error);
        return {
          success: false,
          message: "Error al analizar las etiquetas generadas",
          error: (error as Error).message
        };
      }
    } catch (error) {
      console.error("Error generating tags with probability:", error);
      throw error;
    }
  }
  
  /**
   * Simula una respuesta para cuando la API no está disponible
   * @param prompt El prompt recibido
   * @returns Una respuesta simulada
   */
  private simulateResponse(prompt: string): string {
    console.log("GeminiService: Using simulation mode for prompt:", prompt.substring(0, 100) + "...");
    
    // Respuestas genéricas basadas en palabras clave en el prompt
    if (prompt.includes("mensaje") || prompt.includes("message")) {
      return "Estimado cliente, gracias por su interés en nuestros servicios. Nos gustaría concertar una llamada para discutir cómo podemos ayudarle a alcanzar sus objetivos. ¿Tiene disponibilidad esta semana? Estaré encantado de adaptarme a su agenda.";
    }
    
    if (prompt.includes("analiza") || prompt.includes("analyze")) {
      return "Este lead muestra un potencial moderado-alto. Trabaja en una empresa relevante del sector y su cargo sugiere capacidad de decisión. Recomendación: programar una demostración personalizada y preparar una propuesta específica para sus necesidades. Próximos pasos: 1) Contactar por teléfono, 2) Enviar información personalizada, 3) Programar demostración.";
    }
    
    if (prompt.includes("acción") || prompt.includes("action") || prompt.includes("suger")) {
      return "Programar una llamada de descubrimiento de 15 minutos esta semana. Durante la llamada, centrarse en entender sus desafíos específicos con su actual sistema de gestión, y mencionar brevemente cómo nuestra solución ha resuelto problemas similares para empresas del mismo sector.";
    }
    
    if (prompt.includes("chat") || prompt.includes("conversación")) {
      return "Estoy aquí para ayudarte con tu consulta. Basado en la información proporcionada, te recomendaría considerar nuestro plan Profesional, que incluye todas las funcionalidades que has mencionado. ¿Te gustaría que programáramos una demostración personalizada para mostrarte cómo funcionaría con tu caso específico?";
    }
    
    if (prompt.includes("etiqueta") || prompt.includes("tag") || prompt.includes("probabilit")) {
      return '{"tags":[{"name":"Decisor de compra","probability":82,"category":"característica"},{"name":"Interesado en automatización","probability":75,"category":"interés"},{"name":"Presupuesto disponible","probability":68,"category":"calidad"},{"name":"Ciclo de venta corto","probability":45,"category":"característica"},{"name":"Potencial para upsell","probability":70,"category":"calidad"}]}';
    }
    
    if (prompt.includes("JSON") || prompt.includes("json")) {
      return '{"success":true,"message":"Respuesta simulada para solicitud JSON"}';
    }
    
    // Respuesta por defecto
    return "Como asistente virtual, puedo ayudarte a gestionar tus leads, analizar oportunidades y sugerir acciones para mejorar tus resultados de ventas. ¿En qué puedo ayudarte específicamente hoy?";
  }
}

export const geminiService = GeminiService.getInstance();