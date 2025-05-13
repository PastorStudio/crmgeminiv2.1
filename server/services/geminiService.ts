import { GoogleGenerativeAI } from '@google/generative-ai';
import { apiKeyManager } from './apiKeyManager';
import { Lead, Message } from '@shared/schema';
import { storage } from '../storage';

interface GeminiConfig {
  modelName: string;
  apiKey: string;
  maxOutputTokens?: number;
  temperature?: number;
}

// Clase principal para interactuar con la API de Gemini
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private config: GeminiConfig;
  private simulationMode: boolean = false;

  constructor() {
    // Configuración por defecto
    this.config = {
      modelName: 'gemini-pro',
      apiKey: '',
      maxOutputTokens: 1024,
      temperature: 0.7
    };
    
    // Inicialización
    this.initialize();
  }

  // Inicializa el servicio con la API key disponible
  async initialize(): Promise<void> {
    try {
      // Obtener la API key de la configuración
      const apiKey = process.env.GEMINI_API_KEY || apiKeyManager.getGeminiKey();
      
      if (!apiKey) {
        console.warn("No se encontró una API key para Gemini. Usando modo de simulación.");
        this.simulationMode = true;
        return;
      }
      
      // Configurar el cliente
      this.config.apiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(this.config.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.modelName,
        generationConfig: {
          maxOutputTokens: this.config.maxOutputTokens,
          temperature: this.config.temperature
        }
      });
      
      console.log("Servicio Gemini inicializado correctamente.");
      this.simulationMode = false;
    } catch (error) {
      console.error("Error al inicializar el servicio Gemini:", error);
      this.simulationMode = true;
    }
  }

  // Verifica si el servicio está disponible
  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null && !this.simulationMode;
  }

  // Función para analizar un lead y proporcionar insights
  async analyzeLead(leadId: number): Promise<string> {
    try {
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        throw new Error(`No se encontró el lead con ID ${leadId}`);
      }
      
      // Si estamos en modo simulación, devolver una respuesta simulada
      if (this.simulationMode) {
        return this.simulateAnalysis(lead);
      }
      
      // Preparar el contexto para Gemini
      const leadContext = this.prepareLeadContext(lead);
      
      // Obtener mensajes recientes para más contexto
      const recentMessages = await storage.getMessagesByLead(leadId);
      const messagesContext = this.prepareMessagesContext(recentMessages);
      
      // Prompt para Gemini
      const prompt = `
      Eres un asistente de ventas experto en CRM. Analiza la siguiente información de un lead:
      
      ${leadContext}
      
      ${messagesContext ? `Historial de comunicaciones recientes:\n${messagesContext}` : ''}
      
      Proporciona:
      1. Una evaluación del estado actual del lead (interés, probabilidad de conversión)
      2. Recomendaciones sobre los próximos pasos que deberían tomarse
      3. Ideas específicas para mensajes o acciones personalizadas que podrían resonar con este lead.
      4. Cualquier insight adicional sobre sus necesidades o posibles objeciones.
      
      Basa tu análisis en datos concretos y proporciona sugerencias accionables.
      `;
      
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return text;
    } catch (error) {
      console.error('Error al analizar lead con Gemini:', error);
      
      // Si hay un error, también usamos el modo simulación como fallback
      if (this.simulationMode) {
        const lead = await storage.getLead(leadId);
        return lead ? this.simulateAnalysis(lead) : 'No se pudo realizar el análisis.';
      }
      
      throw error;
    }
  }
  
  // Genera un mensaje personalizado para enviar a un lead
  async generateMessage(leadId: number, messageType: string): Promise<string> {
    try {
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        throw new Error(`No se encontró el lead con ID ${leadId}`);
      }
      
      // Si estamos en modo simulación, devolver una respuesta simulada
      if (this.simulationMode) {
        return this.simulateMessageGeneration(lead, messageType);
      }
      
      // Preparar el contexto para Gemini
      const leadContext = this.prepareLeadContext(lead);
      
      // Obtener mensajes recientes para más contexto
      const recentMessages = await storage.getMessagesByLead(leadId);
      const messagesContext = this.prepareMessagesContext(recentMessages);
      
      // Determinar qué tipo de mensaje generar
      let promptTemplate: string;
      
      switch (messageType) {
        case 'follow-up':
          promptTemplate = `
          Genera un mensaje de seguimiento personalizado para enviar por WhatsApp a este lead:
          
          ${leadContext}
          
          ${messagesContext ? `Historial de comunicaciones recientes:\n${messagesContext}` : ''}
          
          El mensaje debe ser:
          - Breve y conciso (apropiado para WhatsApp)
          - Personalizado con información específica del lead
          - Con un tono amigable pero profesional
          - Con una pregunta abierta o llamada a la acción clara
          - No más de 3-4 oraciones en total
          
          Genera solo el mensaje, sin explicaciones adicionales.
          `;
          break;
          
        case 'welcome':
          promptTemplate = `
          Genera un mensaje de bienvenida personalizado para enviar por WhatsApp a este nuevo lead:
          
          ${leadContext}
          
          El mensaje debe:
          - Presentar brevemente a nuestra empresa/servicio
          - Hacer referencia a cómo obtuvimos su contacto (si se conoce)
          - Expresar interés en sus necesidades
          - Terminar con una pregunta sencilla que invite a la conversación
          - Ser breve (no más de 4 líneas)
          
          Genera solo el mensaje, sin explicaciones adicionales.
          `;
          break;
          
        case 'proposal':
          promptTemplate = `
          Genera un mensaje para enviar por WhatsApp que presente una propuesta de valor a este lead:
          
          ${leadContext}
          
          ${messagesContext ? `Historial de comunicaciones recientes:\n${messagesContext}` : ''}
          
          El mensaje debe:
          - Mencionar un beneficio específico que resuelva un problema del lead
          - Incluir un dato o estadística que respalde la propuesta (si es relevante)
          - Tener un tono confiado pero no agresivo
          - Terminar con una pregunta sobre su interés
          - Ser breve y directo (3-5 líneas máximo)
          
          Genera solo el mensaje, sin explicaciones adicionales.
          `;
          break;
          
        default:
          promptTemplate = `
          Genera un mensaje personalizado para enviar por WhatsApp a este lead:
          
          ${leadContext}
          
          ${messagesContext ? `Historial de comunicaciones recientes:\n${messagesContext}` : ''}
          
          El mensaje debe ser:
          - Relevante para su industria y posición
          - Breve y conciso
          - Con un tono conversacional apropiado para WhatsApp
          - Con una pregunta o llamada a la acción al final
          
          Genera solo el mensaje, sin explicaciones adicionales.
          `;
      }
      
      const result = await this.model.generateContent(promptTemplate);
      const response = result.response;
      const text = response.text();
      
      // Limpiamos el texto de comillas si se generaron
      return text.replace(/^["'](.*)["']$/s, '$1').trim();
    } catch (error) {
      console.error('Error al generar mensaje con Gemini:', error);
      
      // Si hay un error, también usamos el modo simulación como fallback
      if (this.simulationMode) {
        const lead = await storage.getLead(leadId);
        return lead ? this.simulateMessageGeneration(lead, messageType) : 'No se pudo generar el mensaje.';
      }
      
      throw error;
    }
  }
  
  // Funciones auxiliares para preparar contexto
  private prepareLeadContext(lead: Lead): string {
    return `
    DATOS DEL LEAD:
    - Nombre: ${lead.fullName}
    - Email: ${lead.email}
    - Teléfono: ${lead.phone || 'No disponible'}
    - Empresa: ${lead.company || 'No disponible'}
    - Cargo: ${lead.position || 'No disponible'}
    - Fuente: ${lead.source || 'No disponible'}
    - Estado: ${lead.status || 'No disponible'}
    - Puntuación: ${lead.score || 'No disponible'}
    - Datos enriquecidos: ${lead.enrichmentData ? 'Disponible' : 'No disponible'}
    - Porcentaje de coincidencia: ${lead.matchPercentage || 'No disponible'}
    - Notas: ${lead.notes || 'No disponible'}
    - Asignado a: ${lead.assignedTo ? `ID: ${lead.assignedTo}` : 'No asignado'}
    `;
  }
  
  private prepareMessagesContext(messages: Message[] | undefined): string {
    if (!messages || messages.length === 0) {
      return '';
    }
    
    // Ordenamos los mensajes del más antiguo al más reciente
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
    
    // Tomamos máximo los últimos 5 mensajes para no sobrecargar el contexto
    const recentMessages = sortedMessages.slice(-5);
    
    // Formateamos los mensajes
    return recentMessages.map(msg => {
      const date = new Date(msg.sentAt).toLocaleDateString();
      const direction = msg.direction === 'incoming' ? 'CLIENTE' : 'NOSOTROS';
      return `[${date}] ${direction}: ${msg.content}`;
    }).join('\n');
  }
  
  // Simulaciones para cuando no hay API key disponible
  private simulateAnalysis(lead: Lead): string {
    const analysisTemplates = [
      `# Análisis del Lead: ${lead.fullName}

## Evaluación del Estado Actual
El lead muestra un interés moderado en nuestros servicios. Basado en sus interacciones recientes y su perfil, estimamos una probabilidad de conversión del 60-70%.

## Recomendaciones para Próximos Pasos
1. Programar una llamada de descubrimiento para entender mejor sus necesidades específicas
2. Compartir un caso de estudio relevante para su industria
3. Preparar una propuesta preliminar con opciones de diferentes niveles de servicio

## Ideas para Mensajes Personalizados
- Enviar un mensaje destacando cómo hemos ayudado a empresas similares a ${lead.company || 'empresas de su sector'}
- Mencionar específicamente cómo nuestro servicio puede ayudar con ${lead.interests || 'los desafíos comunes en su industria'}
- Ofrecer una demo personalizada enfocada en sus necesidades particulares

## Insights Adicionales
El lead parece estar en la fase de evaluación de alternativas. Es probable que esté considerando a la competencia, por lo que es importante destacar nuestros diferenciadores clave. Su presupuesto parece adecuado para nuestros niveles de servicio estándar o premium.`,

      `# Análisis Detallado: ${lead.fullName} de ${lead.company || 'su empresa'}

## Estado del Lead
Este lead demuestra un alto potencial con una probable tasa de conversión del 75-85%. Su posición como ${lead.position || 'profesional en su campo'} lo convierte en un tomador de decisiones clave.

## Estrategia Recomendada
1. Realizar un acercamiento personalizado destacando el valor específico para su rol
2. Ofrecer una sesión de consulta gratuita para demostrar nuestro conocimiento
3. Seguimiento con material educativo relevante para su industria

## Sugerencias de Comunicación
- Crear un mensaje que resalte los beneficios específicos para ${lead.company || 'su tipo de empresa'}
- Compartir un testimonio de un cliente similar que haya obtenido resultados cuantificables
- Proponer una breve llamada para discutir sus objetivos específicos para este trimestre/año

## Observaciones Adicionales
El lead ha mostrado interés en aspectos específicos como ${lead.interests || 'características comunes de nuestro producto/servicio'}. Es recomendable preparar demostraciones centradas en estas áreas.`
    ];
    
    // Seleccionar aleatoriamente una plantilla
    const randomIndex = Math.floor(Math.random() * analysisTemplates.length);
    return analysisTemplates[randomIndex];
  }
  
  private simulateMessageGeneration(lead: Lead, messageType: string): string {
    const messageTemplates: Record<string, string[]> = {
      'follow-up': [
        `Hola ${lead.fullName}, espero que estés teniendo un buen día. Solo quería hacer un seguimiento sobre nuestra conversación anterior. ¿Has tenido tiempo de revisar la información que te envié? Estoy disponible para resolver cualquier duda que tengas.`,
        
        `Buenos días ${lead.fullName}, ¿cómo va todo? Me preguntaba si habías tenido oportunidad de considerar nuestra propuesta para ${lead.company || 'tu empresa'}. Me encantaría conocer tus impresiones y cómo podríamos ajustarla mejor a tus necesidades.`,
        
        `Hola de nuevo ${lead.fullName}, solo quería asegurarme de que hayas recibido mi mensaje anterior. Estamos implementando algunas mejoras que creo que serían perfectas para tus necesidades. ¿Te gustaría que te cuente más al respecto?`
      ],
      
      'welcome': [
        `¡Hola ${lead.fullName}! Encantado de conectar contigo. Soy [Tu Nombre] de [Tu Empresa]. Nos especializamos en ayudar a ${lead.position ? `profesionales como tú en posiciones de ${lead.position}` : 'profesionales como tú'} a lograr mejores resultados. Me encantaría saber más sobre tus necesidades actuales. ¿Qué desafíos estás enfrentando en este momento?`,
        
        `Bienvenido/a, ${lead.fullName}. Es un placer tenerte con nosotros. En [Tu Empresa] nos dedicamos a [breve descripción]. Me gustaría conocer más sobre ${lead.company || 'tu empresa'} y cómo podríamos colaborar. ¿Cuáles son tus principales objetivos para este trimestre?`,
        
        `Hola ${lead.fullName}, gracias por tu interés en nuestros servicios. Hemos ayudado a muchas empresas como ${lead.company || 'la tuya'} a [beneficio principal]. ¿Te gustaría que te cuente un poco más sobre cómo podríamos ayudarte específicamente?`
      ],
      
      'proposal': [
        `Hola ${lead.fullName}, basado en lo que me has comentado sobre tus necesidades, creo que nuestra solución [Nombre del Producto/Servicio] sería ideal para ti. Nuestros clientes han visto un aumento promedio del 30% en resultados. ¿Te interesaría una demostración personalizada esta semana?`,
        
        `${lead.fullName}, después de analizar las necesidades de ${lead.company || 'tu empresa'}, he preparado una propuesta que podría ayudarte a [resolver problema específico]. Nuestro enfoque único ha permitido a clientes similares reducir costos en un 25%. ¿Cuándo sería un buen momento para discutirla en detalle?`,
        
        `Hola ${lead.fullName}, pensando en los desafíos que mencionaste para ${lead.company || 'tu empresa'}, creo que nuestro [Producto/Servicio] podría ser justo lo que necesitas. Está especialmente diseñado para [beneficio clave]. ¿Te gustaría conocer más sobre cómo implementarlo en tu caso específico?`
      ],
      
      'default': [
        `Hola ${lead.fullName}, espero que estés teniendo una excelente semana. Quería compartir contigo un artículo reciente sobre [tema relevante para su industria] que creo que te podría interesar. ¿Podríamos agendar una breve llamada para discutir cómo aplicar estas ideas en ${lead.company || 'tu empresa'}?`,
        
        `${lead.fullName}, acabo de pensar en ti porque lanzamos una nueva funcionalidad que creo que sería perfecta para ${lead.company || 'tu empresa'}. ¿Te gustaría una demostración rápida?`,
        
        `Hola ${lead.fullName}, espero que todo vaya bien. Me preguntaba si has considerado implementar [solución/estrategia] en ${lead.company || 'tu empresa'}. Hemos visto resultados excelentes con empresas similares. ¿Te interesaría conocer más detalles?`
      ]
    };
    
    // Usar el tipo de mensaje solicitado o el predeterminado si no existe
    const templates = messageTemplates[messageType] || messageTemplates.default;
    
    // Seleccionar aleatoriamente una plantilla
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }
}

// Instancia exportada para uso global
export const geminiService = new GeminiService();