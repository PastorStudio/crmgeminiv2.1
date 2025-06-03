/**
 * Analizador de conversaciones con IA para extracción automática de leads
 * y análisis de intención de clientes
 */
import OpenAI from 'openai';
import { storage } from '../storage';
import { db } from '../db';
import { leads, tickets, whatsappAccounts, conversations, analysisReports } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

interface ConversationAnalysis {
  customerIntent: string;
  leadPotential: number; // 0-100
  urgency: 'low' | 'medium' | 'high';
  category: string;
  keyTopics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  actionRequired: boolean;
  suggestedResponse: string;
  leadData?: {
    name?: string;
    phone?: string;
    email?: string;
    interest?: string;
    budget?: string;
    timeline?: string;
  };
}

interface TicketAnalysis {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  issueType: string;
  resolution: string;
  estimatedTime: string;
  escalationRequired: boolean;
}

export class ConversationAnalyzer {
  private openai: OpenAI;
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key no disponible - análisis de conversaciones deshabilitado');
      return;
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.startAutomaticProcessing();
  }

  /**
   * Inicia el procesamiento automático de conversaciones
   */
  private startAutomaticProcessing(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🤖 Iniciando análisis automático de conversaciones con IA');
    
    // Procesar conversaciones cada 30 segundos
    this.processingInterval = setInterval(async () => {
      await this.processUnanalyzedConversations();
    }, 30000);
    
    // Procesar inmediatamente
    this.processUnanalyzedConversations();
  }

  /**
   * Procesa conversaciones no analizadas
   */
  private async processUnanalyzedConversations(): Promise<void> {
    try {
      console.log('🔍 Buscando conversaciones para analizar...');
      
      // Obtener conversaciones recientes sin analizar
      const unanalyzedConversations = await this.getUnanalyzedConversations();
      
      if (unanalyzedConversations.length === 0) {
        console.log('✅ No hay conversaciones pendientes de análisis');
        return;
      }
      
      console.log(`📊 Analizando ${unanalyzedConversations.length} conversaciones...`);
      
      for (const conversation of unanalyzedConversations) {
        await this.analyzeAndProcessConversation(conversation);
        
        // Pausa entre análisis para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error('❌ Error en procesamiento automático:', error);
    }
  }

  /**
   * Obtiene conversaciones no analizadas
   */
  private async getUnanalyzedConversations(): Promise<any[]> {
    try {
      // Buscar conversaciones recientes que no han sido analizadas
      const conversations = await db.query.conversations.findMany({
        where: and(
          eq(conversations.analyzed, false),
          // Solo conversaciones de las últimas 24 horas
        ),
        orderBy: desc(conversations.createdAt),
        limit: 10
      });
      
      return conversations;
    } catch (error) {
      console.error('❌ Error obteniendo conversaciones:', error);
      return [];
    }
  }

  /**
   * Analiza una conversación completa
   */
  private async analyzeAndProcessConversation(conversation: any): Promise<void> {
    try {
      console.log(`🔍 Analizando conversación ID ${conversation.id} del chat ${conversation.chatId}`);
      
      const analysis = await this.analyzeConversationContent(conversation.messages);
      
      if (!analysis) {
        console.log('⚠️ No se pudo analizar la conversación');
        return;
      }
      
      // Procesar resultados del análisis
      await this.processAnalysisResults(conversation, analysis);
      
      // Marcar como analizada
      await this.markConversationAsAnalyzed(conversation.id, analysis);
      
      console.log(`✅ Conversación ${conversation.id} analizada exitosamente`);
      
    } catch (error) {
      console.error(`❌ Error analizando conversación ${conversation.id}:`, error);
    }
  }

  /**
   * Analiza el contenido de una conversación usando OpenAI
   */
  private async analyzeConversationContent(messages: string): Promise<ConversationAnalysis | null> {
    try {
      const prompt = `
Analiza la siguiente conversación de WhatsApp y extrae información detallada:

CONVERSACIÓN:
${messages}

Por favor, analiza y responde en formato JSON con la siguiente estructura:
{
  "customerIntent": "Descripción clara de lo que busca el cliente",
  "leadPotential": 85,
  "urgency": "high",
  "category": "ventas|soporte|consulta|reclamo|cotización",
  "keyTopics": ["tema1", "tema2", "tema3"],
  "sentiment": "positive",
  "actionRequired": true,
  "suggestedResponse": "Respuesta sugerida profesional",
  "leadData": {
    "name": "Nombre extraído si está disponible",
    "phone": "Teléfono si está mencionado",
    "email": "Email si está mencionado",
    "interest": "Producto/servicio de interés",
    "budget": "Presupuesto mencionado",
    "timeline": "Tiempo mencionado para la decisión"
  }
}

INSTRUCCIONES:
- leadPotential: 0-100 basado en probabilidad de conversión
- urgency: low/medium/high basado en las palabras y contexto
- category: clasifica según el tipo de consulta
- keyTopics: máximo 5 temas principales
- sentiment: positive/neutral/negative basado en el tono
- actionRequired: true si necesita seguimiento inmediato
- leadData: solo incluir datos que estén explícitamente mencionados
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Eres un experto analista de conversaciones de ventas y servicio al cliente. Analiza conversaciones de WhatsApp para extraer insights de negocio."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const analysisText = response.choices[0].message.content;
      if (!analysisText) return null;

      const analysis = JSON.parse(analysisText) as ConversationAnalysis;
      console.log(`📊 Análisis completado - Intent: ${analysis.customerIntent}, Lead Potential: ${analysis.leadPotential}%`);
      
      return analysis;

    } catch (error) {
      console.error('❌ Error en análisis con OpenAI:', error);
      return null;
    }
  }

  /**
   * Procesa los resultados del análisis
   */
  private async processAnalysisResults(conversation: any, analysis: ConversationAnalysis): Promise<void> {
    try {
      // 1. Crear lead automáticamente si el potencial es alto
      if (analysis.leadPotential >= 70) {
        await this.createAutomaticLead(conversation, analysis);
      }
      
      // 2. Crear ticket si requiere acción
      if (analysis.actionRequired || analysis.urgency === 'high') {
        await this.createAutomaticTicket(conversation, analysis);
      }
      
      // 3. Guardar análisis en la base de datos
      await this.saveAnalysisReport(conversation, analysis);
      
    } catch (error) {
      console.error('❌ Error procesando resultados del análisis:', error);
    }
  }

  /**
   * Crea un lead automáticamente
   */
  private async createAutomaticLead(conversation: any, analysis: ConversationAnalysis): Promise<void> {
    try {
      const leadData = {
        title: analysis.leadData?.interest || `Lead automático - ${analysis.category}`,
        value: analysis.leadData?.budget || '0',
        source: 'whatsapp_ai_analysis',
        notes: `
ANÁLISIS AUTOMÁTICO:
- Intención: ${analysis.customerIntent}
- Potencial: ${analysis.leadPotential}%
- Urgencia: ${analysis.urgency}
- Temas clave: ${analysis.keyTopics.join(', ')}
- Sentimiento: ${analysis.sentiment}

DATOS EXTRAÍDOS:
${analysis.leadData ? Object.entries(analysis.leadData)
  .filter(([_, value]) => value)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n') : 'No se extrajeron datos específicos'}

RESPUESTA SUGERIDA:
${analysis.suggestedResponse}
        `,
        status: analysis.urgency === 'high' ? 'hot' : 'warm',
        whatsappAccountId: conversation.accountId,
        contactId: conversation.contactId || 0,
        tags: [...analysis.keyTopics, 'ai_generated', analysis.category],
        customFields: {
          aiAnalysis: analysis,
          originalConversation: conversation.id
        }
      };

      const [newLead] = await db.insert(leads).values(leadData).returning();
      console.log(`✅ Lead automático creado: ID ${newLead.id} (Potencial: ${analysis.leadPotential}%)`);
      
    } catch (error) {
      console.error('❌ Error creando lead automático:', error);
    }
  }

  /**
   * Crea un ticket automáticamente
   */
  private async createAutomaticTicket(conversation: any, analysis: ConversationAnalysis): Promise<void> {
    try {
      const ticketData = {
        title: `${analysis.category.toUpperCase()}: ${analysis.customerIntent.substring(0, 100)}`,
        description: `
ANÁLISIS AUTOMÁTICO DE CONVERSACIÓN:

RESUMEN:
${analysis.customerIntent}

DETALLES:
- Urgencia: ${analysis.urgency}
- Categoría: ${analysis.category}
- Sentimiento: ${analysis.sentiment}
- Temas: ${analysis.keyTopics.join(', ')}

ACCIÓN REQUERIDA:
${analysis.suggestedResponse}

CONVERSACIÓN ORIGINAL:
Chat ID: ${conversation.chatId}
Fecha: ${new Date(conversation.createdAt).toLocaleString()}
        `,
        priority: analysis.urgency === 'high' ? 'urgent' : 
                 analysis.urgency === 'medium' ? 'high' : 'medium',
        status: 'open',
        whatsappAccountId: conversation.accountId,
        contactId: conversation.contactId || 0,
        tags: [...analysis.keyTopics, 'ai_generated'],
        metadata: {
          aiAnalysis: analysis,
          conversationId: conversation.id,
          automaticCreation: true
        }
      };

      const [newTicket] = await db.insert(tickets).values(ticketData).returning();
      console.log(`🎫 Ticket automático creado: ID ${newTicket.id} (Prioridad: ${ticketData.priority})`);
      
    } catch (error) {
      console.error('❌ Error creando ticket automático:', error);
    }
  }

  /**
   * Guarda el reporte de análisis
   */
  private async saveAnalysisReport(conversation: any, analysis: ConversationAnalysis): Promise<void> {
    try {
      // Guardar en tabla de reportes de análisis
      await db.insert(db.query.analysisReports || conversations).values({
        conversationId: conversation.id,
        chatId: conversation.chatId,
        accountId: conversation.accountId,
        analysisData: analysis,
        createdAt: new Date(),
        analysisType: 'conversation_intent'
      }).onConflictDoNothing();
      
    } catch (error) {
      console.error('❌ Error guardando reporte de análisis:', error);
    }
  }

  /**
   * Marca conversación como analizada
   */
  private async markConversationAsAnalyzed(conversationId: number, analysis: ConversationAnalysis): Promise<void> {
    try {
      await db.update(conversations)
        .set({
          analyzed: true,
          analysisData: analysis,
          analyzedAt: new Date()
        })
        .where(eq(conversations.id, conversationId));
        
    } catch (error) {
      console.error('❌ Error marcando conversación como analizada:', error);
    }
  }

  /**
   * Obtiene estadísticas de análisis
   */
  public async getAnalysisStats(): Promise<any> {
    try {
      const stats = {
        totalAnalyzed: 0,
        leadsGenerated: 0,
        ticketsCreated: 0,
        averageLeadPotential: 0,
        topCategories: [],
        sentimentDistribution: {
          positive: 0,
          neutral: 0,
          negative: 0
        }
      };

      // Aquí se implementarían las consultas para obtener estadísticas reales
      return stats;
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }

  /**
   * Detiene el procesamiento automático
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Análisis automático de conversaciones detenido');
  }
}

// Instancia global del analizador
export const conversationAnalyzer = new ConversationAnalyzer();