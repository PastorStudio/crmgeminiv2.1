import { db } from '../db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../storage';

interface AnalyticsParams {
  startDate?: string;
  endDate?: string;
  leadId?: number;
  campaignId?: string;
  category?: string;
}

interface AnalyticsPrediction {
  value: number;
  probability: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  factors: string[];
}

interface AnalyticsInsight {
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  relatedData?: any;
  actions?: string[];
}

const GEMINI_MODEL = "gemini-1.5-pro-latest";

export class AnalyticsService {
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY no está configurada. El servicio de análisis avanzado no funcionará correctamente.');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  /**
   * Predice métricas futuras basadas en datos históricos usando modelos de ML
   */
  async predictMetrics(metric: string, params: AnalyticsParams): Promise<AnalyticsPrediction> {
    // Obtener datos históricos
    const historicalData = await this.getHistoricalData(metric, params);
    
    if (!historicalData || historicalData.length === 0) {
      throw new Error('No hay suficientes datos históricos para generar una predicción');
    }

    try {
      // Usar Gemini para analizar y predecir basado en los datos
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `
Actúa como un modelo de pronóstico con machine learning. Analiza los siguientes datos históricos para la métrica "${metric}" y genera una predicción para el próximo período.

DATOS HISTÓRICOS:
${JSON.stringify(historicalData, null, 2)}

Genera una predicción en formato JSON con los siguientes campos:
- value: número predicho para el próximo período
- probability: probabilidad entre 0 y 1 de que esta predicción sea precisa
- confidence: nivel de confianza entre 0 y 1
- trend: "increasing", "decreasing", o "stable"
- factors: array de factores que influyen en esta predicción

Responde SOLO con el objeto JSON, sin texto adicional.
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Limpiar respuesta y convertir a JSON
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const prediction = JSON.parse(jsonStr) as AnalyticsPrediction;
      
      return prediction;
    } catch (error) {
      console.error('Error al generar predicción de ML:', error);
      throw new Error('No se pudo generar la predicción con el modelo de ML');
    }
  }

  /**
   * Descubre insights relevantes en los datos usando algoritmos de aprendizaje automático
   */
  async generateInsights(params: AnalyticsParams): Promise<AnalyticsInsight[]> {
    try {
      // Obtener datos relevantes
      const leadsData = await this.getLeadsData(params);
      const messagesData = await this.getMessagesData(params);
      const campaignData = await this.getCampaignData(params);
      const activityData = await this.getActivityData(params);
      
      // Preparar contexto para Gemini
      const dataContext = {
        leads: leadsData,
        messages: messagesData,
        campaigns: campaignData,
        activities: activityData
      };
      
      // Usar Gemini para generar insights
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `
Actúa como un analista de datos experto en CRM con conocimiento en análisis avanzado. Analiza los siguientes datos de CRM y genera insights valiosos que puedan ayudar al negocio.

DATOS DEL CRM:
${JSON.stringify(dataContext, null, 2)}

Genera entre 3-5 insights detallados en formato JSON con los siguientes campos para cada uno:
- type: "opportunity" (oportunidad de negocio), "risk" (riesgo identificado), "trend" (tendencia detectada), o "recommendation" (recomendación estratégica)
- title: título breve y descriptivo del insight
- description: explicación detallada del insight y por qué es importante
- impact: "high", "medium", o "low" basado en el impacto potencial para el negocio
- confidence: valor entre 0 y 1 que indica tu nivel de confianza en este insight
- actions: array de acciones recomendadas basadas en este insight

Responde con un array JSON de insights en español, sin texto adicional.
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Limpiar respuesta y convertir a JSON
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const insights = JSON.parse(jsonStr) as AnalyticsInsight[];
      
      return insights;
    } catch (error) {
      console.error('Error al generar insights:', error);
      throw new Error('No se pudieron generar insights con el modelo de ML');
    }
  }

  /**
   * Analiza sentimiento y temas de los mensajes del cliente
   */
  async analyzeCustomerFeedback(params: AnalyticsParams): Promise<any> {
    try {
      // Obtener mensajes para analizar
      const messages = await this.getMessagesData(params);
      
      if (!messages || messages.length === 0) {
        throw new Error('No hay mensajes disponibles para analizar');
      }
      
      // Usar Gemini para analizar sentimiento y temas
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `
Actúa como un analista experto en procesamiento de lenguaje natural. Analiza los siguientes mensajes de clientes y genera un análisis de sentimiento y temas principales.

MENSAJES:
${JSON.stringify(messages, null, 2)}

Genera un análisis en formato JSON con:
1. Una distribución de sentimiento (positivo, negativo, neutro) con porcentajes
2. Los temas principales identificados con su frecuencia
3. Palabras clave más utilizadas
4. Recomendaciones basadas en este análisis

Responde SOLO con el objeto JSON, sin texto adicional.
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Limpiar respuesta y convertir a JSON
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(jsonStr);
      
      return analysis;
    } catch (error) {
      console.error('Error al analizar feedback de clientes:', error);
      throw new Error('No se pudo analizar el feedback de clientes');
    }
  }

  /**
   * Segmenta clientes basado en comportamiento y características
   */
  async segmentCustomers(): Promise<any> {
    try {
      // Obtener todos los leads con sus interacciones
      const leads = await storage.getAllLeads();
      
      // Para cada lead, obtener mensajes y actividades
      const enrichedLeads = await Promise.all(
        leads.map(async (lead) => {
          const messages = await storage.getMessagesByLead(lead.id);
          const activities = await storage.getActivitiesByLead(lead.id);
          
          return {
            ...lead,
            messages,
            activities,
          };
        })
      );
      
      // Usar Gemini para segmentar
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `
Actúa como un especialista en segmentación de clientes. Analiza los siguientes datos de clientes y segméntalos en grupos significativos basados en su comportamiento, interacciones y características.

DATOS DE CLIENTES:
${JSON.stringify(enrichedLeads, null, 2)}

Identifica entre 3-5 segmentos claros y proporciona:
1. Nombre y descripción de cada segmento
2. Características principales de cada segmento
3. Estrategias recomendadas para cada segmento
4. Asignación de cada cliente a un segmento específico

Responde con un objeto JSON que contenga los segmentos y la asignación de clientes.
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Limpiar respuesta y convertir a JSON
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const segmentation = JSON.parse(jsonStr);
      
      return segmentation;
    } catch (error) {
      console.error('Error al segmentar clientes:', error);
      throw new Error('No se pudieron segmentar los clientes con el modelo de ML');
    }
  }

  /**
   * Predice la probabilidad de conversión de leads
   */
  async predictLeadConversion(leadId?: number): Promise<any> {
    try {
      let leads;
      
      if (leadId) {
        const lead = await storage.getLead(leadId);
        if (!lead) {
          throw new Error(`Lead con ID ${leadId} no encontrado`);
        }
        leads = [lead];
      } else {
        leads = await storage.getAllLeads();
      }
      
      // Enriquecer leads con sus interacciones
      const enrichedLeads = await Promise.all(
        leads.map(async (lead) => {
          const messages = await storage.getMessagesByLead(lead.id);
          const activities = await storage.getActivitiesByLead(lead.id);
          
          return {
            ...lead,
            messages,
            activities,
          };
        })
      );
      
      // Usar Gemini para predecir conversión
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
      
      const prompt = `
Actúa como un modelo predictivo de calificación de leads. Analiza los siguientes datos de leads y predice la probabilidad de conversión para cada uno.

DATOS DE LEADS:
${JSON.stringify(enrichedLeads, null, 2)}

Para cada lead, proporciona:
1. ID del lead
2. Probabilidad de conversión (valor entre 0 y 1)
3. Tiempo estimado hasta la conversión (en días)
4. Factores que influyen en esta predicción
5. Acciones recomendadas para incrementar la probabilidad de conversión

Responde con un array JSON con estas predicciones, sin texto adicional.
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Limpiar respuesta y convertir a JSON
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const predictions = JSON.parse(jsonStr);
      
      return predictions;
    } catch (error) {
      console.error('Error al predecir conversión de leads:', error);
      throw new Error('No se pudo predecir la conversión de leads');
    }
  }

  // Métodos auxiliares para obtener datos
  private async getHistoricalData(metric: string, params: AnalyticsParams): Promise<any[]> {
    // Implementación simplificada - En un caso real esto consultaría datos históricos de la BD
    let data: any[] = [];
    
    switch (metric) {
      case 'new_leads':
        // Ejemplo de datos para testing
        data = [
          { date: '2023-01-01', value: 15 },
          { date: '2023-02-01', value: 18 },
          { date: '2023-03-01', value: 22 },
          { date: '2023-04-01', value: 20 },
          { date: '2023-05-01', value: 25 },
          { date: '2023-06-01', value: 30 },
        ];
        break;
      case 'conversion_rate':
        data = [
          { date: '2023-01-01', value: 0.12 },
          { date: '2023-02-01', value: 0.14 },
          { date: '2023-03-01', value: 0.13 },
          { date: '2023-04-01', value: 0.15 },
          { date: '2023-05-01', value: 0.18 },
          { date: '2023-06-01', value: 0.20 },
        ];
        break;
      case 'message_response_time':
        data = [
          { date: '2023-01-01', value: 120 },  // minutes
          { date: '2023-02-01', value: 110 },
          { date: '2023-03-01', value: 95 },
          { date: '2023-04-01', value: 85 },
          { date: '2023-05-01', value: 75 },
          { date: '2023-06-01', value: 60 },
        ];
        break;
      default:
        // Consultar datos de la base de datos en base al parámetro metric
        try {
          // Aquí se implementaría la consulta real a la base de datos
          // El formato debe ser compatible con el modelo: [{date: 'YYYY-MM-DD', value: number}, ...]
        } catch (error) {
          console.error(`Error al obtener datos históricos para ${metric}:`, error);
        }
    }
    
    return data;
  }

  private async getLeadsData(params: AnalyticsParams): Promise<any[]> {
    try {
      if (params.leadId) {
        const lead = await storage.getLead(params.leadId);
        return lead ? [lead] : [];
      } else {
        return await storage.getAllLeads();
      }
    } catch (error) {
      console.error('Error al obtener datos de leads:', error);
      return [];
    }
  }

  private async getMessagesData(params: AnalyticsParams): Promise<any[]> {
    try {
      if (params.leadId) {
        return await storage.getMessagesByLead(params.leadId);
      } else {
        // Implementar lógica para obtener mensajes filtrados por fecha
        return await storage.getRecentMessages(100);
      }
    } catch (error) {
      console.error('Error al obtener datos de mensajes:', error);
      return [];
    }
  }

  private async getCampaignData(params: AnalyticsParams): Promise<any[]> {
    try {
      // Implementar lógica para obtener datos de campañas
      // Por ahora devolvemos un array vacío como placeholder
      return [];
    } catch (error) {
      console.error('Error al obtener datos de campañas:', error);
      return [];
    }
  }

  private async getActivityData(params: AnalyticsParams): Promise<any[]> {
    try {
      if (params.leadId) {
        return await storage.getActivitiesByLead(params.leadId);
      } else {
        // Implementar lógica para obtener actividades filtradas
        return [];
      }
    } catch (error) {
      console.error('Error al obtener datos de actividades:', error);
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService();