import { storage } from '../storage';
import { apiKeyManager } from './apiKeyManager';
import { GeminiService } from './geminiService';

/**
 * Servicio para la gestión inteligente de tareas y etiquetas
 * Utiliza Gemini AI para automatizar la creación de tareas y asignar etiquetas con probabilidades
 */
export class TaskTagService {
  private static instance: TaskTagService;
  private geminiService: GeminiService;

  private constructor() {
    this.geminiService = GeminiService.getInstance();
  }

  /**
   * Devuelve la instancia única del servicio
   */
  public static getInstance(): TaskTagService {
    if (!TaskTagService.instance) {
      TaskTagService.instance = new TaskTagService();
    }
    return TaskTagService.instance;
  }

  /**
   * Analiza un lead y genera tareas automáticas basadas en la información
   * @param leadId ID del lead a analizar
   * @returns Lista de tareas generadas
   */
  public async generateAutomaticTasks(leadId: number): Promise<any[]> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead con ID ${leadId} no encontrado`);
      }

      // Obtener información del lead para contextualizar
      const activities = await storage.getActivitiesByLead(leadId);
      const messages = await storage.getMessagesByLead(leadId);

      // Preparar el prompt para Gemini
      const prompt = `
        Eres un asistente de ventas inteligente que ayuda a crear tareas automáticas para leads.
        Basado en la siguiente información del lead, genera 3 tareas prioritarias que ayudarían a avanzar 
        en el proceso de ventas. Para cada tarea, incluye un título corto, descripción detallada, 
        fecha sugerida (en el formato YYYY-MM-DD), tipo de tarea (llamada, email, reunión, etc) 
        y el nivel de prioridad (alta, media, baja).
        
        Información del lead:
        - Nombre: ${lead.fullName}
        - Email: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado actual: ${lead.status || 'Nuevo'}
        - Fuente: ${lead.source || 'No especificada'}
        - Puntuación: ${lead.score !== null ? lead.score : 'No evaluado'}
        
        Actividades previas:
        ${activities.length > 0 
          ? activities.map(a => `- ${a.type}: ${a.description} (${a.completed ? 'Completada' : 'Pendiente'})`).join('\\n')
          : 'No hay actividades previas registradas.'
        }
        
        Mensajes recientes:
        ${messages.length > 0
          ? messages.slice(0, 5).map(m => `- ${m.sentAt}: ${m.content.substring(0, 100)}...`).join('\\n')
          : 'No hay mensajes recientes.'
        }
        
        Devuelve solo un objeto JSON con el siguiente formato, sin texto adicional:
        {
          "tasks": [
            {
              "title": "Título de la tarea",
              "description": "Descripción detallada",
              "dueDate": "YYYY-MM-DD",
              "type": "tipo de tarea",
              "priority": "prioridad"
            }
          ]
        }
      `;

      // Solicitar a Gemini que genere las tareas
      const response = await this.geminiService.generateContent(prompt);
      
      // Intentar parsear la respuesta como JSON
      try {
        // Extraer solo la parte JSON de la respuesta
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) {
          throw new Error('No se pudo encontrar un objeto JSON en la respuesta');
        }
        
        const jsonStr = jsonMatch[0];
        const tasksData = JSON.parse(jsonStr);
        
        // Verificar que existe el array de tareas
        if (!tasksData.tasks || !Array.isArray(tasksData.tasks)) {
          throw new Error('El formato de tareas no es válido');
        }
        
        // Crear las tareas en el sistema
        const createdTasks = [];
        for (const task of tasksData.tasks) {
          // Convertir la fecha en formato ISO
          const dueDate = new Date(task.dueDate);
          
          // Crear la actividad
          const newActivity = await storage.createActivity({
            leadId,
            userId: 1, // Asignar al usuario administrador por defecto
            type: task.type,
            title: task.title,
            description: task.description,
            dueDate: dueDate.toISOString(),
            completed: false,
            notes: `Tarea generada automáticamente por Gemini AI. Prioridad: ${task.priority}`
          });
          
          createdTasks.push(newActivity);
        }
        
        return createdTasks;
      } catch (error) {
        console.error('Error al procesar la respuesta JSON de Gemini:', error);
        throw new Error('No se pudieron crear las tareas automáticas');
      }
    } catch (error) {
      console.error('Error en generateAutomaticTasks:', error);
      throw error;
    }
  }

  /**
   * Genera etiquetas para un lead con porcentajes de probabilidad
   * @param leadId ID del lead a etiquetar
   * @returns Etiquetas generadas con sus probabilidades
   */
  public async generateTagsWithProbability(leadId: number): Promise<any> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead con ID ${leadId} no encontrado`);
      }

      // Preparar el prompt para Gemini
      const prompt = `
        Eres un analista de ventas que ayuda a identificar y etiquetar leads con probabilidades de conversión.
        Basado en la siguiente información del lead, genera 5 etiquetas relevantes junto con un porcentaje 
        de probabilidad para cada una. Las etiquetas deben reflejar posibles intereses, características, 
        categorías o etapas relevantes para este lead.
        
        Información del lead:
        - Nombre: ${lead.fullName}
        - Email: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado actual: ${lead.status || 'Nuevo'}
        - Fuente: ${lead.source || 'No especificada'}
        - Puntuación: ${lead.score !== null ? lead.score : 'No evaluado'}
        
        Devuelve solo un objeto JSON con el siguiente formato, sin texto adicional:
        {
          "tags": [
            {
              "name": "nombre de la etiqueta",
              "probability": 85,
              "category": "categoría de la etiqueta (interés, característica, etapa)"
            }
          ]
        }
        
        Los porcentajes deben ser números enteros entre 1 y 100.
      `;

      // Solicitar a Gemini que genere las etiquetas
      const response = await this.geminiService.generateContent(prompt);
      
      // Intentar parsear la respuesta como JSON
      try {
        // Extraer solo la parte JSON de la respuesta
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) {
          throw new Error('No se pudo encontrar un objeto JSON en la respuesta');
        }
        
        const jsonStr = jsonMatch[0];
        const tagsData = JSON.parse(jsonStr);
        
        // Verificar que existe el array de etiquetas
        if (!tagsData.tags || !Array.isArray(tagsData.tags)) {
          throw new Error('El formato de etiquetas no es válido');
        }
        
        // Actualizar las etiquetas en el lead
        // Nota: Esto asume que añadiremos un campo para etiquetas en el schema
        // de lead o lo manejaremos como metadatos
        const tagsWithProbability = tagsData.tags.map((tag: any) => ({
          name: tag.name,
          probability: tag.probability,
          category: tag.category
        }));
        
        // Aquí actualizaríamos el lead con las nuevas etiquetas
        // Por ahora solo devolvemos las etiquetas generadas
        return {
          leadId,
          tags: tagsWithProbability
        };
      } catch (error) {
        console.error('Error al procesar la respuesta JSON de Gemini para etiquetas:', error);
        throw new Error('No se pudieron generar etiquetas con probabilidades');
      }
    } catch (error) {
      console.error('Error en generateTagsWithProbability:', error);
      throw error;
    }
  }

  /**
   * Automatiza la gestión completa de un lead basado en análisis del sistema
   * @param leadId ID del lead a gestionar
   * @returns Resultado de las operaciones automáticas realizadas
   */
  public async autoManageLead(leadId: number): Promise<any> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead con ID ${leadId} no encontrado`);
      }

      // 1. Generar tareas automáticas
      const tasks = await this.generateAutomaticTasks(leadId);
      
      // 2. Generar etiquetas con probabilidades
      const tags = await this.generateTagsWithProbability(leadId);
      
      // 3. Analizar y sugerir próxima etapa en el pipeline
      const nextStage = await this.suggestNextPipelineStage(leadId);
      
      // 4. Generar un mensaje de seguimiento personalizado
      const followUpMessage = await this.generateFollowUpMessage(leadId);
      
      // Devolver todos los resultados
      return {
        lead,
        automaticTasks: tasks,
        tagsWithProbability: tags,
        suggestedNextStage: nextStage,
        followUpMessageSuggestion: followUpMessage
      };
    } catch (error) {
      console.error('Error en autoManageLead:', error);
      throw error;
    }
  }

  /**
   * Sugiere la próxima etapa en el pipeline para un lead
   * @param leadId ID del lead a analizar
   * @returns Sugerencia de próxima etapa y justificación
   */
  private async suggestNextPipelineStage(leadId: number): Promise<any> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead con ID ${leadId} no encontrado`);
      }

      // Etapas comunes del pipeline
      const commonStages = [
        'Nuevo Lead',
        'Calificado',
        'Presentación',
        'Propuesta',
        'Negociación',
        'Cerrado Ganado',
        'Cerrado Perdido'
      ];
      
      // Obtener actividades y mensajes para contexto
      const activities = await storage.getActivitiesByLead(leadId);
      const messages = await storage.getMessagesByLead(leadId);
      
      // Preparar el prompt para Gemini
      const prompt = `
        Eres un experto en ventas que ayuda a determinar la mejor etapa del pipeline para los leads.
        Basado en la siguiente información del lead, sugiere cuál debería ser la próxima etapa en el pipeline
        de ventas y proporciona una justificación detallada.
        
        Información del lead:
        - Nombre: ${lead.fullName}
        - Email: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado actual: ${lead.status || 'Nuevo'}
        - Fuente: ${lead.source || 'No especificada'}
        - Puntuación: ${lead.score !== null ? lead.score : 'No evaluado'}
        
        Actividades previas:
        ${activities.length > 0 
          ? activities.map(a => `- ${a.type}: ${a.description} (${a.completed ? 'Completada' : 'Pendiente'})`).join('\\n')
          : 'No hay actividades previas registradas.'
        }
        
        Mensajes recientes:
        ${messages.length > 0
          ? messages.slice(0, 5).map(m => `- ${m.sentAt}: ${m.content.substring(0, 100)}...`).join('\\n')
          : 'No hay mensajes recientes.'
        }
        
        Las etapas disponibles en nuestro pipeline son:
        ${commonStages.join(', ')}
        
        Devuelve solo un objeto JSON con el siguiente formato, sin texto adicional:
        {
          "currentStage": "etapa actual",
          "suggestedStage": "etapa sugerida",
          "confidence": 85,
          "justification": "explicación detallada de por qué se sugiere esta etapa",
          "whatIsNeeded": "lo que se necesita para avanzar a la siguiente etapa"
        }
        
        El nivel de confianza debe ser un número entero entre 1 y 100.
      `;

      // Solicitar a Gemini que sugiera la próxima etapa
      const response = await this.geminiService.generateContent(prompt);
      
      // Intentar parsear la respuesta como JSON
      try {
        // Extraer solo la parte JSON de la respuesta
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) {
          throw new Error('No se pudo encontrar un objeto JSON en la respuesta');
        }
        
        const jsonStr = jsonMatch[0];
        const stageData = JSON.parse(jsonStr);
        
        return stageData;
      } catch (error) {
        console.error('Error al procesar la respuesta JSON de Gemini para etapa del pipeline:', error);
        throw new Error('No se pudo generar sugerencia de etapa del pipeline');
      }
    } catch (error) {
      console.error('Error en suggestNextPipelineStage:', error);
      throw error;
    }
  }

  /**
   * Genera un mensaje de seguimiento personalizado para un lead
   * @param leadId ID del lead para el que se generará el mensaje
   * @returns Mensaje de seguimiento generado
   */
  private async generateFollowUpMessage(leadId: number): Promise<any> {
    try {
      const lead = await storage.getLead(leadId);
      if (!lead) {
        throw new Error(`Lead con ID ${leadId} no encontrado`);
      }

      // Obtener actividades y mensajes para contexto
      const activities = await storage.getActivitiesByLead(leadId);
      const messages = await storage.getMessagesByLead(leadId);
      
      // Determinar tiempo transcurrido desde el último contacto
      let daysSinceLastContact = 30; // Valor por defecto
      if (messages.length > 0) {
        const lastMessageDate = new Date(messages[0].sentAt);
        const today = new Date();
        const timeDiff = today.getTime() - lastMessageDate.getTime();
        daysSinceLastContact = Math.floor(timeDiff / (1000 * 3600 * 24));
      }
      
      // Preparar el prompt para Gemini
      const prompt = `
        Eres un experto en comunicación de ventas que ayuda a crear mensajes de seguimiento personalizados.
        Basado en la siguiente información del lead, genera un mensaje de seguimiento altamente personalizado
        que ayude a avanzar en el proceso de ventas.
        
        Información del lead:
        - Nombre: ${lead.fullName}
        - Email: ${lead.email}
        - Teléfono: ${lead.phone || 'No disponible'}
        - Empresa: ${lead.company || 'No disponible'}
        - Cargo: ${lead.position || 'No disponible'}
        - Estado actual: ${lead.status || 'Nuevo'}
        - Fuente: ${lead.source || 'No especificada'}
        - Días desde último contacto: ${daysSinceLastContact}
        
        Actividades previas:
        ${activities.length > 0 
          ? activities.map(a => `- ${a.type}: ${a.description} (${a.completed ? 'Completada' : 'Pendiente'})`).join('\\n')
          : 'No hay actividades previas registradas.'
        }
        
        Mensajes recientes:
        ${messages.length > 0
          ? messages.slice(0, 3).map(m => `- ${m.sentAt}: ${m.content.substring(0, 100)}...`).join('\\n')
          : 'No hay mensajes recientes.'
        }
        
        Devuelve solo un objeto JSON con el siguiente formato, sin texto adicional:
        {
          "subject": "línea de asunto para un email",
          "bodyText": "cuerpo del mensaje",
          "followUpType": "email, llamada o mensaje de WhatsApp",
          "callToAction": "acción específica que se quiere que el lead tome",
          "timing": "sugerencia sobre el mejor momento para enviar este mensaje"
        }
      `;

      // Solicitar a Gemini que genere el mensaje de seguimiento
      const response = await this.geminiService.generateContent(prompt);
      
      // Intentar parsear la respuesta como JSON
      try {
        // Extraer solo la parte JSON de la respuesta
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (!jsonMatch) {
          throw new Error('No se pudo encontrar un objeto JSON en la respuesta');
        }
        
        const jsonStr = jsonMatch[0];
        const messageData = JSON.parse(jsonStr);
        
        return messageData;
      } catch (error) {
        console.error('Error al procesar la respuesta JSON de Gemini para mensaje de seguimiento:', error);
        throw new Error('No se pudo generar mensaje de seguimiento');
      }
    } catch (error) {
      console.error('Error en generateFollowUpMessage:', error);
      throw error;
    }
  }
}

export const taskTagService = TaskTagService.getInstance();