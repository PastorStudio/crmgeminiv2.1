/**
 * Integración TypeScript para el servicio de respuestas automáticas
 * Este archivo proporciona funcionalidad para conectar el servicio mejorado
 * de respuestas automáticas con el servicio de WhatsApp existente.
 */

import { whatsappService } from './whatsappServiceImpl';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { db, pool } from '../db';
import { createAppointmentFromConversation } from './appointmentDetector';

// Evitar importar db dos veces

// Importaciones de servicios para gestión de claves API
import { getOpenAIApiKey, getGeminiApiKey } from './aiKeysManager';

// Configuración para respuestas automáticas
const config = {
  enabled: true,
  aiProvider: "gemini", // o "openai"
  customPrompts: {
    enabled: true,
    system: `Eres un representante de ventas de élite en Gemini CRM, un software innovador de gestión de relaciones con clientes (CRM) potenciado con Inteligencia Artificial.

Tu objetivo es guiar a los posibles clientes hacia la compra de nuestro sistema CRM siguiendo estas directrices:

1. Sé profesional pero cálido, construyendo rápidamente una conexión emocional con el cliente.
2. Utiliza un lenguaje persuasivo, destacando BENEFICIOS, no solo características. 
3. Personaliza cada respuesta a las necesidades específicas que mencione el cliente.
4. Sugiere soluciones a problemas empresariales comunes que nuestro CRM resuelve.
5. Menciona discretamente cómo nuestro CRM ayuda a incrementar ventas, mejorar retención de clientes y optimizar procesos.
6. Si el cliente muestra interés, ofrece información sobre planes de precios o una demostración.
7. Evita ser excesivamente promocional o usar un lenguaje genérico.
8. SIEMPRE mantén la continuidad de la conversación, recordando lo que el cliente ha mencionado anteriormente.
9. NUNCA inventes características que no existen.

Características principales de Gemini CRM:
- Integración directa con WhatsApp y Telegram
- Análisis de conversaciones con IA para clasificar leads automáticamente
- Respuestas automáticas personalizadas con IA
- Automatización de tareas y seguimientos
- Análisis predictivo de ventas
- Gestión de campañas de marketing
- Panel de estadísticas en tiempo real
- Importación de contactos desde Excel
- Almacenamiento de archivos y multimedia
- Precio base desde $49/mes para 5 usuarios

Recuerda: cada mensaje es una oportunidad para avanzar en el proceso de venta.`,
    temperature: 0.8,
    maxTokens: 500
  },
  excludedChats: [],
  delaySeconds: 2,
  storeConversationHistory: true
};

// Variables para clientes de IA
let openaiClient: OpenAI | null = null;
let geminiClient: any = null;
let isInitialized = false;

/**
 * Inicializa los clientes de IA necesarios para respuestas automáticas
 */
export async function initialize() {
  if (isInitialized) return;
  
  console.log('Inicializando servicio de respuestas automáticas mejorado...');
  
  // Inicializar OpenAI
  try {
    const openaiKey = await getOpenAIApiKey();
    if (openaiKey) {
      openaiClient = new OpenAI({ apiKey: openaiKey });
      console.log('Cliente OpenAI inicializado correctamente para respuestas automáticas');
    } else {
      console.log('No se pudo inicializar OpenAI: falta API key');
    }
  } catch (error) {
    console.error('Error inicializando OpenAI:', error);
  }
  
  // Inicializar Gemini
  try {
    // Importar dinámicamente para evitar problemas circulares
    const { GeminiV1Client } = await import('./geminiV1');
    geminiClient = new GeminiV1Client();
    console.log('Cliente Gemini inicializado correctamente para respuestas automáticas');
  } catch (error) {
    console.error('Error inicializando Gemini:', error);
  }
  
  isInitialized = true;
}

/**
 * Obtiene el historial de conversación para un chat específico
 */
async function getConversationHistory(chatId: string, limit: number = 10): Promise<Array<{message: string, isFromUser: boolean}>> {
  try {
    // Usar SQL nativo de PostgreSQL 
    const query = {
      text: `
        SELECT message_text, is_from_user, timestamp
        FROM conversation_history
        WHERE chat_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `,
      values: [chatId, limit]
    };
    
    const result = await pool.query(query);
    
    // Devolver el resultado invertido para tener orden cronológico
    return result.rows.reverse().map(row => ({
      message: row.message_text,
      isFromUser: row.is_from_user
    }));
  } catch (error) {
    console.error('Error al obtener historial de conversación:', error);
    return [];
  }
}

/**
 * Guarda un mensaje en el historial de conversación
 */
async function saveToConversationHistory(chatId: string, messageText: string, isFromUser: boolean, contextData: any = null): Promise<void> {
  try {
    // Usar SQL nativo de PostgreSQL
    const query = {
      text: `
        INSERT INTO conversation_history (chat_id, message_text, is_from_user, context_data)
        VALUES ($1, $2, $3, $4)
      `,
      values: [chatId, messageText, isFromUser, contextData ? JSON.stringify(contextData) : null]
    };
    
    await pool.query(query);
    
    console.log(`Mensaje ${isFromUser ? 'del usuario' : 'del sistema'} guardado en historial para chat ${chatId}`);
  } catch (error) {
    console.error('Error al guardar mensaje en historial:', error);
  }
}

/**
 * Analiza la conversación para extraer información relevante del cliente
 * @param chatId ID del chat (número de teléfono)
 * @param conversationHistory Historial de mensajes
 * @param lastMessage Último mensaje recibido
 * @returns Objeto con la información extraída
 */
async function extractClientInfo(chatId: string, conversationHistory: Array<{message: string, isFromUser: boolean}>, lastMessage: string): Promise<any> {
  try {
    // Si no hay cliente Gemini configurado, no podemos extraer información
    if (!geminiClient) {
      console.warn('No se puede extraer información del cliente: Gemini no está inicializado');
      return null;
    }
    
    // Formatear la conversación para el análisis
    let conversationText = "HISTORIAL DE CONVERSACIÓN:\n";
    conversationHistory.forEach(entry => {
      const role = entry.isFromUser ? "Cliente" : "Asistente";
      conversationText += `${role}: ${entry.message}\n`;
    });
    
    // Añadir el último mensaje
    conversationText += `Cliente: ${lastMessage}\n`;
    
    // Mejorar análisis con pistas específicas sobre citas y reuniones
    conversationText += `\nANÁLISIS ESPECIAL: Busca cuidadosamente cualquier mención de citas, reuniones o llamadas programadas. 
    Por ejemplo: "nos vemos el lunes", "podemos reunirnos el día 15", "hablamos mañana a las 10am", etc.
    Reconoce fechas y horas tanto específicas como relativas (mañana, próximo lunes, etc.).
    
    GUÍA PARA FECHAS RELATIVAS (Hoy es ${new Date().toISOString().split('T')[0]}):
    - "mañana" = ${new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
    - "pasado mañana" = ${new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().split('T')[0]}
    - "próximo lunes" = fecha del próximo lunes desde hoy
    - "la próxima semana" = una semana desde hoy
    - "en 3 días" = ${new Date(new Date().setDate(new Date().getDate() + 3)).toISOString().split('T')[0]}
    - "el mes que viene" = primer día del próximo mes
    
    Si detectas una cita, asegúrate de marcar "appointment.detected" como true y completar los campos de fecha, hora y descripción.`;
    
    // Definir criterios para niveles de interés
    const interestCriteria = {
      alto: [
        "necesito inmediatamente", "cuándo podemos empezar", "listos para comprar",
        "urgente", "lo necesito ya", "presupuesto aprobado", "toma de decisión",
        "contratación inmediata", "compra", "adquirir", "implementar ahora",
        "muy interesado", "demostración detallada", "cuánto cuesta exactamente",
        "¿cuándo podemos reunirnos?", "agendar una cita", "programar una reunión"
      ],
      medio: [
        "me interesa", "podría funcionar", "dime más", "precios", "opciones",
        "características", "comparativa", "considerando", "evaluando", "tal vez",
        "posibilidad", "próximamente", "en el futuro cercano", "planificando",
        "tal vez podríamos reunirnos", "podríamos hablar después"
      ],
      bajo: [
        "solo estoy preguntando", "información general", "quizás después", "no estoy seguro",
        "sólo explorando opciones", "está muy caro", "no es prioridad", "más adelante",
        "en un futuro", "cuando tenga presupuesto", "solo investigando", "gracias por la info"
      ]
    };
    
    // Prompt para extraer información
    const extractionPrompt = `
Analiza la siguiente conversación y extrae información clave del cliente de forma discreta. 
Devuelve SOLAMENTE un objeto JSON con estos campos:
{
  "phoneNumber": "${chatId.replace('@c.us', '')}", 
  "clientName": "nombre del cliente (si se menciona)",
  "company": "empresa del cliente (si se menciona)",
  "location": "ubicación o dirección (si se menciona)",
  "serviceInterest": "servicio específico que le interesa (detallado)",
  "interestLevel": "alto, medio o bajo, basado en el lenguaje y preguntas",
  "interestPercentage": número entre 0-100 basado en probabilidad de compra,
  "budget": número estimado de presupuesto si se menciona (o null),
  "timeline": "marco temporal para decisión/implementación (o null)",
  "decisionMaker": "true/false si es la persona que toma decisiones",
  "competitors": "competidores que está evaluando (si menciona)",
  "painPoints": "problemas actuales que está enfrentando",
  "appointment": {
    "detected": true/false,
    "description": "descripción de la cita (si se detecta)",
    "date": "fecha en formato YYYY-MM-DD (si se menciona)",
    "time": "hora en formato HH:MM (si se menciona)",
    "type": "meeting/call/followup (tipo de cita)"
  },
  "notes": "información adicional relevante"
}

Criterios para determinar el nivel de interés:
- ALTO (70-100%): Menciona urgencia, presupuesto aprobado, preguntas específicas sobre implementación, solicita una prueba/demo, habla de contratar pronto, menciona decisión inmediata.
- MEDIO (40-69%): Solicita más información, pregunta por precios/planes, solicita características específicas, muestra consideración activa, pide comparativas.
- BAJO (0-39%): Solo busca información general, menciona "tal vez en el futuro", muestra preocupación por costos, respuestas cortas, no hace preguntas de seguimiento.

Si algún campo no se puede determinar, déjalo como null o como cadena vacía. NO INVENTES INFORMACIÓN.
Analiza el lenguaje y contexto cuidadosamente para determinar el nivel de interés.
`;

    console.log('Extrayendo información del cliente con IA...');
    const result = await geminiClient.generateContent(
      extractionPrompt + "\n\n" + conversationText,
      "gemini-pro",
      {
        temperature: 0.2,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
      }
    );
    
    // Intentar parsear el resultado como JSON
    try {
      // Limpiar el resultado para asegurar que solo tengamos JSON
      let jsonText = result.trim();
      // A veces Gemini devuelve el JSON con texto adicional, intentamos extraer solo el JSON
      const jsonStart = jsonText.indexOf('{');
      const jsonEnd = jsonText.lastIndexOf('}') + 1;
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        jsonText = jsonText.substring(jsonStart, jsonEnd);
      }
      
      const clientInfo = JSON.parse(jsonText);
      console.log('Información del cliente extraída con éxito:', clientInfo);
      return clientInfo;
    } catch (parseError) {
      console.error('Error al parsear resultado de extracción de información:', parseError);
      console.log('Texto recibido:', result);
      return null;
    }
  } catch (error) {
    console.error('Error al extraer información del cliente:', error);
    return null;
  }
}

/**
 * Actualiza o crea un lead en la base de datos con la información extraída
 */
async function updateOrCreateLead(clientInfo: any): Promise<void> {
  if (!clientInfo) return;
  
  try {
    // Primero buscar si ya existe un lead con este número de teléfono
    const query = {
      text: `
        SELECT id FROM leads 
        WHERE phone = $1 
        LIMIT 1
      `,
      values: [clientInfo.phoneNumber]
    };
    
    const result = await pool.query(query);
    
    if (result.rows.length > 0) {
      // Actualizar lead existente
      const existingLeadId = result.rows[0].id;
      
      // Generar etiquetas inteligentes basadas en la conversación
      const generateTags = () => {
        const tags = [];
        
        // Etiqueta de interés basada en el nivel detectado
        tags.push(`interés-${clientInfo.interestLevel || 'bajo'}`);
        
        // Etiqueta de servicio específico
        if (clientInfo.serviceInterest) {
          tags.push(`servicio-${clientInfo.serviceInterest.toLowerCase() || 'general'}`);
        }
        
        // Etiquetas basadas en urgencia/plazo
        if (clientInfo.timeline) {
          if (clientInfo.timeline.includes('inmediato') || clientInfo.timeline.includes('urgente')) {
            tags.push('urgencia-alta');
          } else if (clientInfo.timeline.includes('mes') || clientInfo.timeline.includes('semana')) {
            tags.push('plazo-corto');
          } else if (clientInfo.timeline.includes('trimestre') || clientInfo.timeline.includes('año')) {
            tags.push('plazo-largo');
          }
        }
        
        // Etiqueta basada en presupuesto
        if (clientInfo.budget) {
          if (clientInfo.budget > 5000) {
            tags.push('presupuesto-alto');
          } else if (clientInfo.budget > 1000) {
            tags.push('presupuesto-medio');
          } else {
            tags.push('presupuesto-bajo');
          }
        }
        
        // Etiqueta de toma de decisiones
        if (clientInfo.decisionMaker === 'true') {
          tags.push('tomador-decisiones');
        } else if (clientInfo.decisionMaker === 'false') {
          tags.push('influenciador');
        }
        
        // Etiqueta de problemas específicos
        if (clientInfo.painPoints) {
          if (clientInfo.painPoints.includes('tiempo')) {
            tags.push('problema-tiempo');
          }
          if (clientInfo.painPoints.includes('costo') || clientInfo.painPoints.includes('precio')) {
            tags.push('problema-costo');
          }
          if (clientInfo.painPoints.includes('calidad')) {
            tags.push('problema-calidad');
          }
          if (clientInfo.painPoints.includes('integración')) {
            tags.push('problema-integración');
          }
        }
        
        // Limitar a máximo 5 etiquetas para no saturar
        return tags.slice(0, 5);
      };
      
      // Obtener etiquetas generadas
      const tags = generateTags();
      
      // Preparar notas completas
      const notesText = `
Ubicación: ${clientInfo.location || 'No especificada'}
Interés: ${clientInfo.serviceInterest || 'No especificado'}
Nivel de interés: ${clientInfo.interestLevel} (${clientInfo.interestPercentage}%)
Presupuesto: ${clientInfo.budget ? `$${clientInfo.budget}` : 'No especificado'}
Plazo: ${clientInfo.timeline || 'No especificado'}
Tomador de decisiones: ${clientInfo.decisionMaker === 'true' ? 'Sí' : clientInfo.decisionMaker === 'false' ? 'No' : 'Sin determinar'}
Competidores: ${clientInfo.competitors || 'No mencionados'}
Problemas: ${clientInfo.painPoints || 'No mencionados'}
Notas: ${clientInfo.notes || 'Ninguna'}
      `.trim();
      
      // Preparar datos para actualización
      const updateQuery = {
        text: `
          UPDATE leads 
          SET 
            name = COALESCE($1, name),
            company = COALESCE($2, company),
            notes = 
              CASE 
                WHEN notes IS NULL THEN $3
                ELSE notes || E'\n\nActualización (' || NOW()::text || '):\n' || $3
              END,
            status = 
              CASE 
                WHEN $4 >= 70 THEN 'hot'
                WHEN $4 >= 40 THEN 'warm'
                ELSE 'cold'
              END,
            tags = 
              CASE 
                WHEN tags IS NULL THEN $5::text[]
                ELSE array_cat(tags, $5::text[])
              END
          WHERE id = $6
          RETURNING id
        `,
        values: [
          clientInfo.clientName || null,
          clientInfo.company || null,
          notesText,
          clientInfo.interestPercentage || 0,
          tags,
          leadId
        ]
      };
      
      const updateResult = await pool.query(updateQuery);
      const updatedLeadId = updateResult.rows[0].id;
      console.log(`Lead actualizado con ID: ${updatedLeadId}`);
      
      // Verificar si hay información de cita en la conversación
      if (clientInfo.appointment && clientInfo.appointment.detected === true) {
        // Crear cita automáticamente para el lead existente
        await createAppointmentFromConversation(clientInfo, updatedLeadId);
      }
    } else {
      // Generar etiquetas inteligentes para el nuevo lead
      const generateTags = () => {
        const tags = [];
        
        // Etiqueta de interés basada en el nivel detectado
        tags.push(`interés-${clientInfo.interestLevel || 'bajo'}`);
        
        // Etiqueta de servicio específico
        if (clientInfo.serviceInterest) {
          tags.push(`servicio-${clientInfo.serviceInterest.toLowerCase() || 'general'}`);
        }
        
        // Etiquetas basadas en urgencia/plazo
        if (clientInfo.timeline) {
          if (clientInfo.timeline.includes('inmediato') || clientInfo.timeline.includes('urgente')) {
            tags.push('urgencia-alta');
          } else if (clientInfo.timeline.includes('mes') || clientInfo.timeline.includes('semana')) {
            tags.push('plazo-corto');
          } else if (clientInfo.timeline.includes('trimestre') || clientInfo.timeline.includes('año')) {
            tags.push('plazo-largo');
          }
        }
        
        // Etiqueta basada en presupuesto
        if (clientInfo.budget) {
          if (clientInfo.budget > 5000) {
            tags.push('presupuesto-alto');
          } else if (clientInfo.budget > 1000) {
            tags.push('presupuesto-medio');
          } else {
            tags.push('presupuesto-bajo');
          }
        }
        
        // Etiqueta de toma de decisiones
        if (clientInfo.decisionMaker === 'true') {
          tags.push('tomador-decisiones');
        } else if (clientInfo.decisionMaker === 'false') {
          tags.push('influenciador');
        }
        
        // Etiqueta de problemas específicos
        if (clientInfo.painPoints) {
          if (clientInfo.painPoints.includes('tiempo')) {
            tags.push('problema-tiempo');
          }
          if (clientInfo.painPoints.includes('costo') || clientInfo.painPoints.includes('precio')) {
            tags.push('problema-costo');
          }
          if (clientInfo.painPoints.includes('calidad')) {
            tags.push('problema-calidad');
          }
          if (clientInfo.painPoints.includes('integración')) {
            tags.push('problema-integración');
          }
        }
        
        // Limitar a máximo 5 etiquetas para no saturar
        return tags.slice(0, 5);
      };
      
      // Obtener etiquetas generadas
      const tags = generateTags();
      
      // Preparar notas completas
      const notesText = `
Ubicación: ${clientInfo.location || 'No especificada'}
Interés: ${clientInfo.serviceInterest || 'No especificado'}
Nivel de interés: ${clientInfo.interestLevel} (${clientInfo.interestPercentage}%)
Presupuesto: ${clientInfo.budget ? `$${clientInfo.budget}` : 'No especificado'}
Plazo: ${clientInfo.timeline || 'No especificado'}
Tomador de decisiones: ${clientInfo.decisionMaker === 'true' ? 'Sí' : clientInfo.decisionMaker === 'false' ? 'No' : 'Sin determinar'}
Competidores: ${clientInfo.competitors || 'No mencionados'}
Problemas: ${clientInfo.painPoints || 'No mencionados'}
Notas: ${clientInfo.notes || 'Ninguna'}
      `.trim();
      
      // Crear nuevo lead
      const insertQuery = {
        text: `
          INSERT INTO leads (
            name, 
            phone, 
            company, 
            source, 
            status, 
            notes,
            tags,
            created_at
          )
          VALUES ($1, $2, $3, 'whatsapp', 
            CASE 
              WHEN $4 >= 70 THEN 'hot'
              WHEN $4 >= 40 THEN 'warm'
              ELSE 'cold'
            END, 
            $5,
            $6::text[],
            NOW()
          )
          RETURNING id
        `,
        values: [
          clientInfo.clientName || 'Cliente de WhatsApp',
          clientInfo.phoneNumber,
          clientInfo.company || null,
          clientInfo.interestPercentage || 0,
          notesText,
          tags
        ]
      };
      
      const insertResult = await pool.query(insertQuery);
      const leadId = insertResult.rows[0].id;
      console.log(`Nuevo lead creado con ID: ${leadId}`);
      
      // Verificar si hay información de cita en la conversación
      if (clientInfo.appointment && clientInfo.appointment.detected === true) {
        // Crear cita automáticamente
        await createAppointmentFromConversation(clientInfo, leadId);
      }
    }
  } catch (error) {
    console.error('Error al actualizar/crear lead:', error);
  }
}

/**
 * Maneja un mensaje de WhatsApp entrante para generar una posible respuesta automática
 */
export async function handleIncomingMessage(message: any) {
  // Verificar si el servicio está habilitado
  if (!config.enabled) {
    return;
  }
  
  // Ignorar mensajes enviados por nosotros
  if (message.fromMe) {
    return;
  }
  
  // Verificar si el chat está excluido
  if (config.excludedChats.includes(message.from)) {
    return;
  }
  
  // Asegurarse de que los clientes estén inicializados
  if (!isInitialized) {
    await initialize();
  }
  
  // Obtener nombre del contacto
  let contactName = 'cliente';
  try {
    const contact = await message.getContact();
    contactName = contact.name || contact.pushname || 'cliente';
    console.log(`Nombre del contacto para respuesta automática: ${contactName}`);
  } catch (err) {
    console.warn('No se pudo obtener el nombre del contacto para respuesta automática');
  }
  
  // Guardar mensaje del usuario en el historial si está habilitado
  if (config.storeConversationHistory) {
    await saveToConversationHistory(message.from, message.body, true, {
      contactName,
      timestamp: new Date().toISOString()
    });
  }
  
  // Obtener historial de conversación si está habilitado
  let conversationHistory = [];
  if (config.storeConversationHistory) {
    conversationHistory = await getConversationHistory(message.from, 10);
    console.log(`Recuperado historial de conversación para ${message.from}: ${conversationHistory.length} mensajes`);
  }
  
  // Extraer información del cliente y actualizar lead
  // Usar configuración para determinar frecuencia
  const extractionConfig = {
    enabled: true,
    frequency: 2, // Analizar cada 2 mensajes (más frecuente)
    minMessages: 1 // Mínimo de mensajes para iniciar análisis
  };
  
  if (conversationHistory.length >= extractionConfig.minMessages && 
      conversationHistory.length % extractionConfig.frequency === 0 &&
      extractionConfig.enabled) {
    console.log('Iniciando extracción de información del cliente...');
    const clientInfo = await extractClientInfo(message.from, conversationHistory, message.body);
    if (clientInfo) {
      await updateOrCreateLead(clientInfo);
    }
  }
  
  // Generar respuesta con IA, incluyendo historial
  let responseText = await generateAIResponse(message.body, contactName, conversationHistory);
  
  // Si hay una respuesta, enviarla con retraso para simular escritura
  if (responseText && responseText.trim()) {
    // Guardar respuesta en el historial si está habilitado
    if (config.storeConversationHistory) {
      await saveToConversationHistory(message.from, responseText, false, {
        aiProvider: config.aiProvider,
        timestamp: new Date().toISOString()
      });
    }
    
    setTimeout(async () => {
      try {
        // Simular estado de escritura
        const chat = await message.getChat();
        await chat.sendStateTyping();
        
        // Esperar un poco más antes de enviar el mensaje
        setTimeout(async () => {
          try {
            // Enviar la respuesta
            await message.reply(responseText);
            console.log('Respuesta automática enviada con éxito');
          } catch (sendError) {
            console.error('Error al enviar respuesta automática:', sendError);
          }
        }, 2000);
      } catch (typingError) {
        console.error('Error al enviar estado de escritura:', typingError);
        
        // Si falla el estado de escritura, intentar enviar directamente
        try {
          await message.reply(responseText);
          console.log('Respuesta automática enviada (sin estado de escritura)');
        } catch (finalError) {
          console.error('Error final al enviar respuesta automática:', finalError);
        }
      }
    }, config.delaySeconds * 1000);
  }
}

/**
 * Genera una respuesta utilizando IA
 */
async function generateAIResponse(
  messageText: string, 
  contactName: string, 
  conversationHistory: Array<{message: string, isFromUser: boolean}> = []
): Promise<string> {
  // Primero intentar con el proveedor configurado
  if (config.aiProvider === "openai" && openaiClient) {
    try {
      return await generateWithOpenAI(messageText, contactName, conversationHistory);
    } catch (error) {
      console.error('Error con OpenAI:', error);
      // Si falla, intentar con Gemini como respaldo
      if (geminiClient) {
        try {
          return await generateWithGemini(messageText, contactName, conversationHistory);
        } catch (innerError) {
          console.error('Error con Gemini (respaldo):', innerError);
        }
      }
    }
  } else if (geminiClient) {
    try {
      return await generateWithGemini(messageText, contactName, conversationHistory);
    } catch (error) {
      console.error('Error con Gemini:', error);
      // Si falla, intentar con OpenAI como respaldo
      if (openaiClient) {
        try {
          return await generateWithOpenAI(messageText, contactName, conversationHistory);
        } catch (innerError) {
          console.error('Error con OpenAI (respaldo):', innerError);
        }
      }
    }
  }
  
  // Si todo falla, devolver cadena vacía para que no se envíe ningún mensaje
  return "";
}

/**
 * Genera respuesta usando OpenAI
 */
async function generateWithOpenAI(
  messageText: string, 
  contactName: string, 
  conversationHistory: Array<{message: string, isFromUser: boolean}> = []
): Promise<string> {
  if (!openaiClient) throw new Error("Cliente OpenAI no inicializado");
  
  const systemPrompt = config.customPrompts.system
    .replace(/{{nombre}}/g, contactName);
  
  // Instrucción específica para evitar los mensajes genéricos
  const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANTE: Evita iniciar la respuesta con saludos genéricos como "Hola, gracias por tu mensaje" o "En breve nos pondremos en contacto contigo". Personaliza tu respuesta directamente al contexto del mensaje y al cliente.`;
  
  // Crear mensajes para el historial de conversación
  const messages = [
    { role: "system", content: enhancedSystemPrompt },
  ];
  
  // Añadir historial de conversación si existe
  if (conversationHistory && conversationHistory.length > 0) {
    console.log(`Usando ${conversationHistory.length} mensajes de historial para respuesta con OpenAI`);
    // Añadir historial de conversación previo
    conversationHistory.forEach(entry => {
      messages.push({
        role: entry.isFromUser ? "user" : "assistant",
        content: entry.message
      });
    });
  }
  
  // Añadir el mensaje actual del usuario
  messages.push({ role: "user", content: messageText });
  
  const response = await openaiClient.chat.completions.create({
    model: "gpt-4o", // el modelo más reciente de OpenAI es "gpt-4o" 
    messages: messages,
    temperature: config.customPrompts.temperature,
    max_tokens: config.customPrompts.maxTokens,
  });
  
  const result = response.choices[0].message.content || "";
  
  // Verificar que no esté vacío
  if (!result || result.trim() === "") {
    throw new Error("OpenAI devolvió una respuesta vacía");
  }
  
  return result;
}

/**
 * Genera respuesta usando Gemini
 */
async function generateWithGemini(
  messageText: string, 
  contactName: string, 
  conversationHistory: Array<{message: string, isFromUser: boolean}> = []
): Promise<string> {
  if (!geminiClient) throw new Error("Cliente Gemini no inicializado");
  
  const systemPrompt = config.customPrompts.system
    .replace(/{{nombre}}/g, contactName);
  
  // Formatear el prompt para Gemini incluyendo el historial
  let fullPrompt = systemPrompt + "\n\n";
  
  // Añadir historial de conversación si existe
  if (conversationHistory && conversationHistory.length > 0) {
    console.log(`Usando ${conversationHistory.length} mensajes de historial para respuesta con Gemini`);
    
    fullPrompt += "HISTORIAL DE CONVERSACIÓN:\n";
    conversationHistory.forEach(entry => {
      const role = entry.isFromUser ? "Cliente" : "Asistente";
      fullPrompt += `${role}: ${entry.message}\n`;
    });
    
    fullPrompt += "\nBasado en el historial anterior, responde al siguiente mensaje:\n";
  }
  
  // Añadir el mensaje actual
  fullPrompt += `Mensaje actual del cliente: ${messageText}\n\nTu respuesta:`;
  
  const result = await geminiClient.generateContent(
    fullPrompt,
    "gemini-pro",
    {
      temperature: config.customPrompts.temperature,
      maxOutputTokens: config.customPrompts.maxTokens,
      topP: 0.8,
      topK: 40
    }
  );
  
  // Verificar que no esté vacío
  if (!result || result.trim() === "") {
    throw new Error("Gemini devolvió una respuesta vacía");
  }
  
  return result;
}

/**
 * Integra el servicio de respuestas automáticas con el servicio de WhatsApp
 */
export async function setupAutoResponsesWithWhatsApp() {
  try {
    // Inicializar los clientes de IA
    await initialize();
    
    // Verificar que el servicio de WhatsApp esté disponible
    if (!whatsappService) {
      throw new Error('Servicio de WhatsApp no disponible');
    }
    
    // Escuchar eventos de mensajes
    whatsappService.on('message', async (message: any) => {
      try {
        await handleIncomingMessage(message);
      } catch (error) {
        console.error('Error procesando mensaje para respuesta automática:', error);
      }
    });
    
    console.log('Servicio de respuestas automáticas integrado correctamente con WhatsApp');
    return true;
  } catch (error) {
    console.error('Error al integrar servicio de respuestas automáticas con WhatsApp:', error);
    return false;
  }
}

/**
 * Configura las respuestas automáticas
 */
export function setAutoResponseConfig(newConfig: any) {
  config.enabled = newConfig.enabled ?? config.enabled;
  config.aiProvider = newConfig.aiProvider ?? config.aiProvider;
  config.delaySeconds = newConfig.delaySeconds ?? config.delaySeconds;
  
  if (newConfig.customPrompts) {
    config.customPrompts = {
      ...config.customPrompts,
      ...newConfig.customPrompts
    };
  }
  
  if (newConfig.excludedChats) {
    config.excludedChats = [...newConfig.excludedChats];
  }
  
  console.log('Configuración de respuestas automáticas actualizada:', config);
}

/**
 * Obtiene la configuración actual
 */
export function getAutoResponseConfig() {
  return { ...config };
}