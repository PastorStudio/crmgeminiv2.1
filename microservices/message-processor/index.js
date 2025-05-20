/**
 * Servidor de procesamiento de mensajes - Microservicio independiente
 * 
 * Este servidor procesa los mensajes recibidos de WhatsApp para detectar
 * intenciones, responder automáticamente cuando es necesario y proporcionar
 * análisis usando AI (Gemini).
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();
const PORT = process.env.MESSAGE_PROCESSOR_PORT || 5002;
const DATABASE_SERVER = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';
const WHATSAPP_SERVER = process.env.WHATSAPP_SERVER_URL || 'http://localhost:5001';
const API_SERVER = process.env.API_SERVER_URL || 'http://localhost:5000';

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Configuración de respuestas automáticas (en memoria)
let autoResponseConfig = {
  enabled: false,
  greetingMessage: 'Gracias por contactarnos. En breve un asesor le atenderá.',
  outOfHoursMessage: 'Gracias por su mensaje. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Le responderemos en cuanto estemos disponibles.',
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
  workingDays: '1,2,3,4,5', // Lunes a Viernes
  settings: {}
};

// Configuración de Gemini AI
let geminiConfig = {
  enabled: false,
  apiKey: process.env.GEMINI_API_KEY || '',
  model: 'gemini-pro',
  temperature: 0.7,
  maxTokens: 1024,
  style: 'balanced',
  settings: {}
};

// Inicializar Gemini AI
let genAI = null;
let geminiModel = null;

function initializeGemini() {
  if (!geminiConfig.apiKey) {
    console.warn('No se ha configurado una API key para Gemini AI');
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
    geminiModel = genAI.getGenerativeModel({ model: geminiConfig.model });
    console.log('Gemini AI inicializado correctamente');
    geminiConfig.enabled = true;
    return true;
  } catch (error) {
    console.error('Error al inicializar Gemini AI:', error);
    geminiConfig.enabled = false;
    return false;
  }
}

// Intentar inicializar Gemini AI al inicio
initializeGemini();

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'message-processor',
    timestamp: new Date().toISOString(),
    autoResponseEnabled: autoResponseConfig.enabled,
    geminiEnabled: geminiConfig.enabled
  });
});

// Obtener configuración de respuestas automáticas
app.get('/auto-response/config', async (req, res) => {
  try {
    // Intentar obtener configuración de la base de datos
    try {
      const response = await axios.get(`${DATABASE_SERVER}/auto-response/config`);
      autoResponseConfig = response.data;
      console.log('Configuración de respuestas automáticas cargada desde la base de datos');
    } catch (dbError) {
      console.warn('Error al obtener configuración desde BD, usando configuración en memoria:', dbError.message);
    }
    
    res.json(autoResponseConfig);
  } catch (error) {
    console.error('Error al obtener configuración de respuestas automáticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener configuración de respuestas automáticas',
      error: error.message
    });
  }
});

// Actualizar configuración de respuestas automáticas
app.post('/auto-response/config', async (req, res) => {
  try {
    const updatedConfig = req.body;
    
    // Validar campos mínimos
    if (updatedConfig.enabled === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo enabled'
      });
    }
    
    // Actualizar configuración
    autoResponseConfig = {
      ...autoResponseConfig,
      ...updatedConfig
    };
    
    // Guardar en la base de datos
    try {
      await axios.post(`${DATABASE_SERVER}/auto-response/config`, autoResponseConfig);
      console.log('Configuración de respuestas automáticas guardada en la base de datos');
    } catch (dbError) {
      console.warn('Error al guardar configuración en la base de datos:', dbError.message);
    }
    
    res.json({
      status: 'ok',
      message: 'Configuración actualizada correctamente',
      config: autoResponseConfig
    });
  } catch (error) {
    console.error('Error al actualizar configuración de respuestas automáticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar configuración de respuestas automáticas',
      error: error.message
    });
  }
});

// Configurar Gemini AI
app.post('/ai/config', async (req, res) => {
  try {
    const { apiKey, model, temperature, maxTokens, style, enabled } = req.body;
    
    // Actualizar configuración
    if (apiKey !== undefined) geminiConfig.apiKey = apiKey;
    if (model !== undefined) geminiConfig.model = model;
    if (temperature !== undefined) geminiConfig.temperature = temperature;
    if (maxTokens !== undefined) geminiConfig.maxTokens = maxTokens;
    if (style !== undefined) geminiConfig.style = style;
    if (enabled !== undefined) geminiConfig.enabled = enabled;
    
    // Reinicializar con la nueva configuración
    const initialized = initializeGemini();
    
    res.json({
      status: 'ok',
      message: initialized 
        ? 'Configuración de Gemini AI actualizada correctamente' 
        : 'Configuración actualizada pero no se pudo inicializar Gemini AI',
      initialized,
      config: {
        ...geminiConfig,
        apiKey: geminiConfig.apiKey ? '••••••••' : '' // No devolver la API key completa
      }
    });
  } catch (error) {
    console.error('Error al configurar Gemini AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al configurar Gemini AI',
      error: error.message
    });
  }
});

// Procesar un mensaje recibido (llamado por el servidor de WhatsApp)
app.post('/process-message', async (req, res) => {
  try {
    const { accountId, message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo message'
      });
    }
    
    console.log(`Procesando mensaje de cuenta ${accountId}: ${message.content?.substring(0, 50)}${message.content?.length > 50 ? '...' : ''}`);
    
    // Realizar análisis rápido del mensaje
    const analysis = await basicAnalysis(message.content);
    
    // Verificar si debemos enviar una respuesta automática
    let shouldRespond = false;
    let responseMessage = '';
    
    // Solo responder si está habilitado
    if (autoResponseConfig.enabled) {
      // Verificar horario de atención
      const isWithinBusinessHours = checkBusinessHours();
      const isFirstMessage = await isFirstContactMessage(message.chatId, accountId);
      
      if (isFirstMessage) {
        // Enviar mensaje de bienvenida o fuera de horario
        shouldRespond = true;
        responseMessage = isWithinBusinessHours 
          ? autoResponseConfig.greetingMessage 
          : autoResponseConfig.outOfHoursMessage;
      }
      else if (analysis.isQuestion && analysis.questionType === 'service') {
        // Responder a preguntas sobre el servicio
        shouldRespond = true;
        responseMessage = autoResponseConfig.greetingMessage;
      }
    }
    
    // Si hay que responder, enviar mensaje
    if (shouldRespond && responseMessage) {
      try {
        console.log(`Enviando respuesta automática a ${message.chatId} desde cuenta ${accountId}`);
        
        // Enviar mensaje a través del servidor de WhatsApp
        await axios.post(`${WHATSAPP_SERVER}/accounts/${accountId}/send`, {
          chatId: message.chatId,
          message: responseMessage
        });
        
        // Notificar al servidor API
        try {
          await axios.post(`${API_SERVER}/internal/auto-response/notification`, {
            accountId,
            chatId: message.chatId,
            originalMessage: message,
            responseMessage,
            analysis
          });
        } catch (notifyError) {
          console.warn('Error al notificar respuesta automática:', notifyError.message);
        }
      } catch (sendError) {
        console.error('Error al enviar respuesta automática:', sendError);
      }
    }
    
    // Guardar análisis en la base de datos junto al mensaje
    try {
      await axios.post(`${DATABASE_SERVER}/execute-query`, {
        query: `UPDATE whatsapp_messages 
                SET metadata = jsonb_set(metadata, '{analysis}', $1::jsonb) 
                WHERE "messageId" = $2`,
        params: [JSON.stringify(analysis), message.messageId]
      });
    } catch (dbError) {
      console.warn('Error al guardar análisis en la base de datos:', dbError.message);
    }
    
    res.json({
      status: 'ok',
      message: 'Mensaje procesado correctamente',
      analysis,
      autoResponse: shouldRespond ? {
        sent: true,
        message: responseMessage
      } : {
        sent: false
      }
    });
  } catch (error) {
    console.error('Error al procesar mensaje:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al procesar mensaje',
      error: error.message
    });
  }
});

// Analizar un texto manualmente
app.post('/analyze', async (req, res) => {
  try {
    const { text, context } = req.body;
    
    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo text'
      });
    }
    
    // Realizar análisis básico
    const basicResults = await basicAnalysis(text);
    
    // Si hay contexto y Gemini está habilitado, realizar análisis avanzado
    let advancedAnalysis = null;
    if (context && geminiConfig.enabled) {
      advancedAnalysis = await analyzeMessage(text, context);
    }
    
    res.json({
      status: 'ok',
      basic: basicResults,
      advanced: advancedAnalysis,
      geminiEnabled: geminiConfig.enabled
    });
  } catch (error) {
    console.error('Error al analizar texto:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al analizar texto',
      error: error.message
    });
  }
});

// Función para verificar si es el primer mensaje de un contacto
async function isFirstContactMessage(chatId, accountId) {
  try {
    // Contar mensajes previos de este chat
    const response = await axios.get(`${DATABASE_SERVER}/messages/${chatId}?accountId=${accountId}&limit=2`);
    return response.data.length <= 1; // Si solo hay 1 o 0 mensajes, es el primero
  } catch (error) {
    console.warn(`Error al verificar si es primer mensaje de ${chatId}:`, error.message);
    return false; // En caso de error, asumir que no es el primer mensaje
  }
}

// Función para verificar si es horario de atención
function checkBusinessHours() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ...
  
  // Verificar si hoy es día laboral
  const workingDays = autoResponseConfig.workingDays.split(',').map(d => parseInt(d));
  if (!workingDays.includes(dayOfWeek)) {
    return false;
  }
  
  // Obtener hora actual
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinutes; // Convertir a minutos desde medianoche
  
  // Obtener horarios de trabajo
  const startTimeParts = autoResponseConfig.businessHoursStart.split(':');
  const endTimeParts = autoResponseConfig.businessHoursEnd.split(':');
  
  const startTime = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
  const endTime = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
  
  // Verificar si la hora actual está dentro del horario
  return currentTime >= startTime && currentTime <= endTime;
}

// Función para análisis básico de mensaje
function basicAnalysis(message) {
  // Análisis simple sin IA
  const result = {
    isQuestion: false,
    questionType: null,
    hasGreeting: false,
    hasThanks: false,
    hasComplaint: false,
    keywordCategories: [],
    language: 'es', // Asumimos español por defecto
    sentiment: 'neutral'
  };
  
  // Detectar si es una pregunta
  result.isQuestion = message.includes('?') || 
                     /^(qué|cómo|cuándo|dónde|quién|cuál|cuánto|por qué)/i.test(message);
  
  // Detectar tipo de pregunta
  if (result.isQuestion) {
    if (/horario|abierto|atienden|están atendiendo|hora/i.test(message)) {
      result.questionType = 'schedule';
    } else if (/precio|costo|valor|cuánto cuesta|tarifa/i.test(message)) {
      result.questionType = 'price';
    } else if (/producto|servicio|tienen|hay|disponible/i.test(message)) {
      result.questionType = 'product';
    } else if (/ayuda|atención|asesor|problema|ayudar/i.test(message)) {
      result.questionType = 'service';
    }
  }
  
  // Detectar saludos
  result.hasGreeting = /hola|buenos días|buenas tardes|buenas noches|saludos/i.test(message);
  
  // Detectar agradecimientos
  result.hasThanks = /gracias|agradec|agradezco/i.test(message);
  
  // Detectar quejas
  result.hasComplaint = /queja|molesto|molestia|problema|error|mal servicio|mala atención|no funciona|no sirve/i.test(message);
  
  // Categorías de palabras clave
  if (/compra|pagar|precio|costo|valor|adquirir/i.test(message)) {
    result.keywordCategories.push('purchase');
  }
  if (/envío|entrega|dirección|enviar|llegar|llegada/i.test(message)) {
    result.keywordCategories.push('shipping');
  }
  if (/devolver|devolución|cambio|garantía|reembolso/i.test(message)) {
    result.keywordCategories.push('return');
  }
  if (/producto|artículo|modelo|referencia|catálogo/i.test(message)) {
    result.keywordCategories.push('product');
  }
  if (/ayuda|soporte|asistencia|problema|error/i.test(message)) {
    result.keywordCategories.push('support');
  }
  
  // Detectar idioma (muy básico)
  if (/hello|good morning|good afternoon|good evening|thanks|hi there|help|service/i.test(message)) {
    result.language = 'en';
  }
  
  // Análisis simple de sentimiento
  const positiveWords = /excelente|bueno|genial|fabuloso|maravilloso|encantado|gracias|feliz|contento|satisfecho/i;
  const negativeWords = /malo|terrible|pésimo|horrible|problema|queja|molesto|molestia|error|insatisfecho|inconforme/i;
  
  if (positiveWords.test(message)) {
    result.sentiment = 'positive';
  } else if (negativeWords.test(message)) {
    result.sentiment = 'negative';
  }
  
  return result;
}

// Función para análisis avanzado con Gemini AI
async function analyzeMessage(message, contextMessages = []) {
  if (!geminiConfig.enabled || !geminiModel) {
    return {
      error: 'Gemini AI no está configurado o habilitado'
    };
  }
  
  try {
    // Construir prompt para el análisis
    let prompt = `Analiza el siguiente mensaje de un cliente por WhatsApp y proporciona un resumen de intenciones y sentimiento:
      
Mensaje: "${message}"
      
Si es relevante, este es el contexto de mensajes anteriores:
${contextMessages.map((m, i) => `[${i+1}] ${m.fromMe ? 'Empresa:' : 'Cliente:'} ${m.content}`).join('\n')}
      
Por favor proporciona la siguiente información en formato JSON:
1. Intención principal del usuario (consulta, queja, solicitud, agradecimiento, etc.)
2. Sentimiento (positivo, negativo, neutral)
3. Temas clave mencionados
4. Si requiere atención humana urgente (true/false)
5. Sugerencia de respuesta breve
     
Responde solo con el JSON, sin texto adicional.`;
    
    // Configurar la generación
    const generationConfig = {
      temperature: geminiConfig.temperature,
      maxOutputTokens: geminiConfig.maxTokens,
    };
    
    // Realizar la llamada
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });
    
    const response = result.response;
    const text = response.text();
    
    // Intentar parsear la respuesta como JSON
    try {
      // Extraer solo el contenido JSON (puede venir con comillas al inicio o final)
      const jsonMatch = text.match(/{[\s\S]*}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { raw: text, error: 'No se pudo extraer JSON válido de la respuesta' };
    } catch (jsonError) {
      console.error('Error al parsear respuesta de Gemini:', jsonError);
      return { raw: text, error: 'Error al parsear respuesta como JSON' };
    }
  } catch (error) {
    console.error('Error en análisis con Gemini AI:', error);
    return {
      error: `Error al procesar con Gemini AI: ${error.message}`
    };
  }
}

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Servidor de procesamiento de mensajes iniciado en http://0.0.0.0:${PORT}`);
  
  // Cargar configuración desde la base de datos
  try {
    console.log('Cargando configuración desde la base de datos...');
    const response = await axios.get(`${DATABASE_SERVER}/auto-response/config`);
    autoResponseConfig = response.data;
    console.log('Configuración de respuestas automáticas cargada correctamente');
  } catch (error) {
    console.warn('No se pudo cargar la configuración desde la base de datos:', error.message);
    console.log('Usando configuración por defecto');
  }
});

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('Cerrando servidor de procesamiento de mensajes...');
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor de procesamiento de mensajes...');
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});