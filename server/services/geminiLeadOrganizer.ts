import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../storage';
import type { Lead, Activity, Message } from '@shared/schema';

interface LeadAnalysis {
  priority: 'high' | 'medium' | 'low';
  score: number;
  category: string;
  nextAction: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  conversionProbability: number;
  reasoning: string;
  suggestedFollowUp: string;
  timeline: string;
}

interface TicketClassification {
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  category: string;
  department: string;
  estimatedResolutionTime: string;
  requiredSkills: string[];
  escalationNeeded: boolean;
  reasoning: string;
}

interface PipelineOptimization {
  currentStage: string;
  nextStage: string;
  stageProgress: number;
  blockers: string[];
  opportunities: string[];
  recommendations: string[];
  timeToClose: string;
}

export class GeminiLeadOrganizer {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API Key no encontrada');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  // ***** ANÁLISIS INTELIGENTE DE LEADS *****
  async analyzeLeadPriority(lead: Lead, recentMessages: Message[] = []): Promise<LeadAnalysis> {
    try {
      const messagesContext = recentMessages.length > 0 
        ? `Mensajes recientes: ${recentMessages.map(m => m.content).join('. ')}`
        : 'Sin mensajes recientes';

      const prompt = `
Analiza este lead y proporciona una evaluación detallada:

INFORMACIÓN DEL LEAD:
- Nombre: ${lead.name}
- Email: ${lead.email}
- Teléfono: ${lead.phone}
- Empresa: ${lead.company}
- Estado actual: ${lead.status}
- Presupuesto: ${lead.budget ? `$${lead.budget}` : 'No especificado'}
- Prioridad actual: ${lead.priority}
- Fuente: ${lead.source}
- Notas: ${lead.notes}
- ${messagesContext}

Proporciona un análisis en formato JSON con esta estructura exacta:
{
  "priority": "high|medium|low",
  "score": [número del 1-100],
  "category": "[categoría de lead: Enterprise, SMB, Startup, etc.]",
  "nextAction": "[acción específica recomendada]",
  "sentiment": "positive|neutral|negative",
  "conversionProbability": [porcentaje del 0-100],
  "reasoning": "[explicación del análisis]",
  "suggestedFollowUp": "[mensaje o acción de seguimiento específica]",
  "timeline": "[tiempo recomendado para siguiente contacto]"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();
      
      // Extraer JSON del texto
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No se pudo extraer análisis válido');
    } catch (error) {
      console.error('Error en análisis de lead:', error);
      // Fallback con análisis básico
      return {
        priority: 'medium',
        score: 50,
        category: 'General',
        nextAction: 'Contactar para más información',
        sentiment: 'neutral',
        conversionProbability: 30,
        reasoning: 'Análisis básico aplicado',
        suggestedFollowUp: 'Enviar email de seguimiento',
        timeline: '2-3 días'
      };
    }
  }

  // ***** CLASIFICACIÓN INTELIGENTE DE TICKETS *****
  async classifyTicket(ticketData: any): Promise<TicketClassification> {
    try {
      const prompt = `
Clasifica este ticket de soporte técnico:

INFORMACIÓN DEL TICKET:
- Título: ${ticketData.title || 'Sin título'}
- Descripción: ${ticketData.description || 'Sin descripción'}
- Cliente: ${ticketData.customer || 'Desconocido'}
- Tipo: ${ticketData.type || 'General'}
- Canal: ${ticketData.channel || 'Email'}

Proporciona clasificación en formato JSON:
{
  "urgency": "urgent|high|medium|low",
  "category": "[Técnico, Billing, Feature Request, Bug, etc.]",
  "department": "[IT, Sales, Support, Product, etc.]",
  "estimatedResolutionTime": "[tiempo estimado]",
  "requiredSkills": ["habilidad1", "habilidad2"],
  "escalationNeeded": true/false,
  "reasoning": "[explicación de la clasificación]"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();
      
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No se pudo extraer clasificación válida');
    } catch (error) {
      console.error('Error en clasificación de ticket:', error);
      return {
        urgency: 'medium',
        category: 'General',
        department: 'Support',
        estimatedResolutionTime: '24-48 horas',
        requiredSkills: ['Soporte general'],
        escalationNeeded: false,
        reasoning: 'Clasificación básica aplicada'
      };
    }
  }

  // ***** OPTIMIZACIÓN DEL PIPELINE DE VENTAS *****
  async optimizeSalesPipeline(lead: Lead, activities: Activity[]): Promise<PipelineOptimization> {
    try {
      const activitiesContext = activities.length > 0
        ? `Actividades: ${activities.map(a => `${a.type}: ${a.description}`).join('. ')}`
        : 'Sin actividades registradas';

      const prompt = `
Analiza el progreso en el pipeline de ventas:

LEAD INFORMACIÓN:
- Estado: ${lead.status}
- Presupuesto: ${lead.budget}
- Prioridad: ${lead.priority}
- Fuente: ${lead.source}
- Días desde creación: ${lead.createdAt ? Math.floor((new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 'Desconocido'}
- ${activitiesContext}

Proporciona optimización en formato JSON:
{
  "currentStage": "[etapa actual del pipeline]",
  "nextStage": "[siguiente etapa recomendada]",
  "stageProgress": [porcentaje 0-100],
  "blockers": ["obstáculo1", "obstáculo2"],
  "opportunities": ["oportunidad1", "oportunidad2"],
  "recommendations": ["recomendación1", "recomendación2"],
  "timeToClose": "[tiempo estimado para cerrar]"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();
      
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No se pudo extraer optimización válida');
    } catch (error) {
      console.error('Error en optimización de pipeline:', error);
      return {
        currentStage: 'Contacto inicial',
        nextStage: 'Calificación',
        stageProgress: 25,
        blockers: ['Falta información de contacto'],
        opportunities: ['Interés mostrado'],
        recommendations: ['Programar llamada de descubrimiento'],
        timeToClose: '2-4 semanas'
      };
    }
  }

  // ***** ORGANIZADOR AUTOMÁTICO DE LEADS *****
  async organizeAllLeads(): Promise<{ organized: number, insights: string[] }> {
    try {
      console.log('🤖 Iniciando organización inteligente de leads con Gemini AI...');
      
      const leads = await storage.getAllLeads();
      const insights: string[] = [];
      let organized = 0;

      for (const lead of leads) {
        try {
          // Analizar lead
          const analysis = await this.analyzeLeadPriority(lead);
          
          // Actualizar lead con insights de AI
          await storage.updateLead(lead.id, {
            priority: analysis.priority,
            notes: `${lead.notes || ''}\n\n[AI Analysis] Score: ${analysis.score}/100, Category: ${analysis.category}, Next: ${analysis.nextAction}`
          });

          insights.push(`Lead ${lead.name}: ${analysis.reasoning}`);
          organized++;
          
          // Pausa para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error procesando lead ${lead.id}:`, error);
        }
      }

      console.log(`✅ Organizados ${organized} leads con Gemini AI`);
      return { organized, insights };
    } catch (error) {
      console.error('Error en organización automática:', error);
      return { organized: 0, insights: ['Error en organización automática'] };
    }
  }

  // ***** GENERADOR DE REPORTES INTELIGENTES *****
  async generateSmartReport(leads: Lead[]): Promise<string> {
    try {
      const leadsSummary = leads.map(lead => ({
        name: lead.name,
        status: lead.status,
        priority: lead.priority,
        budget: lead.budget,
        source: lead.source
      }));

      const prompt = `
Genera un reporte ejecutivo inteligente basado en estos leads:

DATOS: ${JSON.stringify(leadsSummary, null, 2)}

El reporte debe incluir:
1. Resumen ejecutivo
2. Insights clave
3. Oportunidades identificadas
4. Recomendaciones estratégicas
5. Próximos pasos

Formato: Reporte profesional en español`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generando reporte:', error);
      return 'Error al generar reporte inteligente';
    }
  }
}

export const geminiLeadOrganizer = new GeminiLeadOrganizer();