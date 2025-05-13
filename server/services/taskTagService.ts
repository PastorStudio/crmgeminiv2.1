import { storage } from "../storage";
import { InsertActivity } from "@shared/schema";
import { geminiService } from './geminiService';
import { addDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Servicio para gestionar la creación automática de tareas y etiquetas utilizando IA
 */
export class TaskTagService {
  private static instance: TaskTagService;
  
  private constructor() { }
  
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
   * Gestiona automáticamente un lead usando IA:
   * - Genera etiquetas con probabilidades
   * - Crea tareas automáticas basadas en el perfil
   * - Actualiza el score y otros metadatos del lead
   * 
   * @param leadId ID del lead a gestionar
   * @returns Resultado de la gestión automática
   */
  public async autoManageLead(leadId: number): Promise<any> {
    try {
      // 1. Obtener datos del lead
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        throw new Error(`Lead con ID ${leadId} no encontrado`);
      }
      
      // 2. Analizar lead con Gemini para obtener insights
      const analysis = await geminiService.analyzeLead(leadId);
      
      // 3. Generar etiquetas con probabilidades
      const tagsWithProbability = await geminiService.generateTagsWithProbability(leadId);
      
      // 4. Generar tareas automáticas
      const automaticTasks = await this.generateAutomaticTasks(leadId);
      
      // 5. Actualizar datos del lead con la información generada
      const updatedLead = await storage.updateLead(leadId, {
        tags: JSON.stringify(tagsWithProbability.tags),
        aiAnalysis: analysis,
        score: this.calculateLeadScore(tagsWithProbability.tags),
        lastAiUpdate: new Date()
      });
      
      // 6. Devolver resultado completo
      return {
        success: true,
        lead: updatedLead,
        tagsWithProbability,
        automaticTasks,
        analysis
      };
    } catch (error) {
      console.error("Error en autoManageLead:", error);
      throw error;
    }
  }
  
  /**
   * Genera tareas automáticas para un lead basadas en su perfil e historial
   * 
   * @param leadId ID del lead
   * @returns Array de tareas generadas
   */
  public async generateAutomaticTasks(leadId: number): Promise<any[]> {
    try {
      // 1. Obtener datos del lead
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        throw new Error(`Lead con ID ${leadId} no encontrado`);
      }
      
      // 2. Obtener actividades existentes para no duplicar
      const existingActivities = await storage.getActivitiesByLead(leadId);
      
      // 3. Determinar perfil y etapa del lead basado en su estado y tags
      const leadTags = lead.tags ? JSON.parse(lead.tags) : [];
      const leadProfile = this.determineLeadProfile(lead, leadTags);
      
      // 4. Generar tareas según el perfil
      const tasks = this.generateTasksBasedOnProfile(lead, leadProfile);
      
      // 5. Guardar las tareas en la base de datos
      const createdTasks = [];
      
      for (const task of tasks) {
        // Verificar si ya existe una tarea similar
        const existingSimilar = existingActivities.find(a => 
          a.title.toLowerCase().includes(task.title.toLowerCase()) && 
          !a.completed
        );
        
        if (!existingSimilar) {
          const newActivity: InsertActivity = {
            leadId: leadId,
            title: task.title,
            description: task.description,
            type: task.type,
            priority: task.priority,
            startTime: task.dueDate ? new Date(task.dueDate) : addDays(new Date(), 1),
            completed: false,
            aiGenerated: true,
            aiSummary: task.aiSummary || "Tarea generada automáticamente por IA"
          };
          
          const createdActivity = await storage.createActivity(newActivity);
          createdTasks.push({
            ...task,
            id: createdActivity.id,
            createdAt: createdActivity.createdAt
          });
        }
      }
      
      return createdTasks;
    } catch (error) {
      console.error("Error en generateAutomaticTasks:", error);
      throw error;
    }
  }
  
  /**
   * Determina el perfil de un lead basado en sus características y etiquetas
   * @param lead Datos del lead
   * @param tags Etiquetas del lead
   * @returns Perfil del lead
   */
  private determineLeadProfile(lead: any, tags: any[]): string {
    // Determinar si hay etiquetas de alta prioridad
    const highPriorityTags = tags.filter(tag => tag.probability >= 80);
    const interestTags = tags.filter(tag => 
      tag.category === 'interés' || 
      tag.category === 'intención' ||
      tag.category === 'intereses' ||
      tag.category === 'necesidades'
    );
    
    // Determinar el perfil basado en el estado y etiquetas
    if (lead.status === 'new') {
      if (highPriorityTags.length > 0) {
        return "nuevo_prioritario";
      }
      return "nuevo_estandar";
    } else if (lead.status === 'contacted') {
      if (highPriorityTags.length > 0 && interestTags.length > 0) {
        return "contactado_interesado";
      }
      return "contactado_seguimiento";
    } else if (lead.status === 'meeting') {
      return "reunion_programada";
    } else if (lead.status === 'closed-won') {
      return "cliente_nuevo";
    } else if (lead.status === 'closed-lost') {
      return "recuperacion";
    }
    
    return "estandar";
  }
  
  /**
   * Genera tareas basadas en el perfil del lead
   * @param lead Datos del lead
   * @param profile Perfil determinado del lead
   * @returns Array de tareas generadas
   */
  private generateTasksBasedOnProfile(lead: any, profile: string): any[] {
    const tasks = [];
    const today = new Date();
    
    switch (profile) {
      case "nuevo_prioritario":
        tasks.push({
          title: `Llamar a ${lead.fullName} para presentación inicial`,
          description: `Contactar a ${lead.fullName} para presentar nuestros servicios y evaluar sus necesidades. Este lead ha sido identificado como prioritario por la IA.`,
          type: "llamada",
          priority: "alta",
          dueDate: addDays(today, 1).toISOString(),
          aiSummary: "Lead prioritario que requiere contacto inmediato"
        });
        tasks.push({
          title: `Enviar información personalizada a ${lead.fullName}`,
          description: `Preparar paquete de información personalizada basada en los intereses detectados y enviar por email.`,
          type: "email",
          priority: "media",
          dueDate: addDays(today, 2).toISOString(),
          aiSummary: "Seguimiento con información relevante a intereses específicos"
        });
        break;
        
      case "nuevo_estandar":
        tasks.push({
          title: `Enviar email inicial a ${lead.fullName}`,
          description: `Enviar un email de introducción presentando nuestros servicios y solicitando una llamada de descubrimiento.`,
          type: "email",
          priority: "media",
          dueDate: addDays(today, 2).toISOString(),
          aiSummary: "Primer contacto con nuevo lead"
        });
        break;
        
      case "contactado_interesado":
        tasks.push({
          title: `Programar demostración con ${lead.fullName}`,
          description: `Contactar a ${lead.fullName} para coordinar una demostración personalizada de nuestros servicios/productos.`,
          type: "llamada",
          priority: "alta",
          dueDate: addDays(today, 1).toISOString(),
          aiSummary: "Lead interesado listo para demostración"
        });
        tasks.push({
          title: `Preparar propuesta para ${lead.fullName}`,
          description: `Elaborar una propuesta personalizada basada en las necesidades identificadas.`,
          type: "tarea",
          priority: "alta",
          dueDate: addDays(today, 3).toISOString(),
          aiSummary: "Propuesta personalizada requerida"
        });
        break;
        
      case "contactado_seguimiento":
        tasks.push({
          title: `Seguimiento a ${lead.fullName}`,
          description: `Realizar seguimiento con ${lead.fullName} para confirmar recepción de información y resolver dudas.`,
          type: "llamada",
          priority: "media",
          dueDate: addDays(today, 3).toISOString(),
          aiSummary: "Seguimiento estándar de contacto inicial"
        });
        break;
        
      case "reunion_programada":
        tasks.push({
          title: `Preparar material para reunión con ${lead.fullName}`,
          description: `Preparar presentación y material personalizado para la próxima reunión.`,
          type: "tarea",
          priority: "alta",
          dueDate: addDays(today, 1).toISOString(),
          aiSummary: "Preparación de material para reunión próxima"
        });
        tasks.push({
          title: `Enviar recordatorio de reunión a ${lead.fullName}`,
          description: `Enviar email recordatorio 24 horas antes de la reunión programada.`,
          type: "email",
          priority: "baja",
          dueDate: addDays(today, 2).toISOString(),
          aiSummary: "Recordatorio de reunión programada"
        });
        break;
        
      case "cliente_nuevo":
        tasks.push({
          title: `Llamada de bienvenida a ${lead.fullName}`,
          description: `Realizar llamada de bienvenida para iniciar el proceso de onboarding.`,
          type: "llamada",
          priority: "alta",
          dueDate: addDays(today, 1).toISOString(),
          aiSummary: "Inicio de onboarding con nuevo cliente"
        });
        tasks.push({
          title: `Configurar cuenta para ${lead.fullName}`,
          description: `Iniciar el proceso de configuración de la cuenta para el nuevo cliente.`,
          type: "tarea",
          priority: "alta",
          dueDate: addDays(today, 2).toISOString(),
          aiSummary: "Configuración de cuenta para cliente nuevo"
        });
        break;
        
      case "recuperacion":
        tasks.push({
          title: `Encuesta de feedback a ${lead.fullName}`,
          description: `Enviar encuesta para entender por qué no avanzó y cómo podríamos mejorar en el futuro.`,
          type: "email",
          priority: "baja",
          dueDate: addDays(today, 5).toISOString(),
          aiSummary: "Encuesta para obtener retroalimentación de oportunidad perdida"
        });
        break;
        
      default: // caso "estandar"
        tasks.push({
          title: `Seguimiento general a ${lead.fullName}`,
          description: `Realizar seguimiento general para avanzar en el proceso de venta.`,
          type: "llamada",
          priority: "media",
          dueDate: addDays(today, 3).toISOString(),
          aiSummary: "Seguimiento estándar de proceso"
        });
    }
    
    // Tarea general que se añade para todos los perfiles excepto clientes y cerrados
    if (profile !== "cliente_nuevo" && profile !== "recuperacion") {
      tasks.push({
        title: `Investigar ${lead.company || 'empresa'} de ${lead.fullName}`,
        description: `Realizar investigación sobre ${lead.company || 'la empresa'} para entender mejor su contexto y necesidades.`,
        type: "tarea",
        priority: "media",
        dueDate: addDays(today, 2).toISOString(),
        aiSummary: "Investigación de empresa para contextualizar necesidades"
      });
    }
    
    return tasks;
  }
  
  /**
   * Calcula un score para el lead basado en sus etiquetas con probabilidades
   * @param tags Etiquetas con probabilidades
   * @returns Score calculado (0-100)
   */
  private calculateLeadScore(tags: any[]): number {
    if (!tags || tags.length === 0) {
      return 50; // Valor por defecto si no hay etiquetas
    }
    
    // Factores de puntuación por categoría
    const categoryWeights: { [key: string]: number } = {
      'interés': 2.0,
      'intereses': 2.0,
      'intención': 2.5,
      'presupuesto': 1.8,
      'autoridad': 1.5,
      'necesidades': 1.7,
      'etapa': 1.2,
      'desafíos': 1.0,
      'demografía': 0.7,
      'comportamiento': 1.3,
      'objeciones': -0.5, // Las objeciones reducen el score
      'riesgos': -0.8     // Los riesgos reducen aún más el score
    };
    
    // Calcular puntuación ponderada
    let totalScore = 0;
    let weightSum = 0;
    
    tags.forEach(tag => {
      const category = tag.category.toLowerCase();
      const weight = categoryWeights[category] || 1.0;
      
      totalScore += (tag.probability * weight);
      weightSum += weight;
    });
    
    // Normalizar a escala 0-100
    const normalizedScore = weightSum > 0 ? (totalScore / (weightSum * 100)) * 100 : 50;
    
    // Asegurar que esté en el rango 0-100
    return Math.max(0, Math.min(100, Math.round(normalizedScore)));
  }
  
  /**
   * Predice la fecha óptima para el próximo seguimiento
   * @param lead Datos del lead
   * @param activities Actividades asociadas al lead
   * @returns Fecha recomendada
   */
  public predictNextFollowUpDate(lead: any, activities: any[]): Date {
    // Lógica simple: si es cliente nuevo o contactado_interesado, seguimiento rápido (2-3 días)
    // Si es estándar o nuevo, seguimiento normal (5-7 días)
    // Si es lead perdido, seguimiento a largo plazo (30 días)
    
    const today = new Date();
    let daysToAdd = 5; // valor por defecto
    
    // Determinar días según estado
    if (lead.status === 'closed-won') {
      daysToAdd = 2; // Cliente nuevo: seguimiento muy rápido
    } else if (lead.status === 'meeting') {
      daysToAdd = 1; // Seguimiento al día siguiente de la reunión
    } else if (lead.status === 'contacted') {
      daysToAdd = 3; // Seguimiento estándar para contactados
    } else if (lead.status === 'closed-lost') {
      daysToAdd = 30; // Seguimiento a largo plazo para recuperación
    }
    
    // Ajustar según última actividad (si existe)
    const sortedActivities = activities.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    if (sortedActivities.length > 0) {
      const lastActivityDate = new Date(sortedActivities[0].createdAt || today);
      
      // Si la última actividad es muy reciente (menos de 1 día), extender el plazo
      const daysSinceLastActivity = Math.floor(
        (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastActivity < 1) {
        daysToAdd += 1; // Dar un día más si hubo actividad reciente
      }
    }
    
    // Calcular fecha resultado
    return addDays(today, daysToAdd);
  }
}

export const taskTagService = TaskTagService.getInstance();