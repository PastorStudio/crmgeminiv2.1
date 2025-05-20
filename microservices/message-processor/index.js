/**
 * Procesador de mensajes - Microservicio independiente
 * 
 * Este microservicio procesa los mensajes de WhatsApp para:
 * - Detectar intención del usuario
 * - Generar respuestas automáticas
 * - Analizar sentimiento y contenido
 * - Extraer datos relevantes (fechas, números, etc.)
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.MESSAGE_PROCESSOR_PORT || 5002;
const DATABASE_SERVER_URL = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';
const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL || 'http://localhost:5001';

// Configuración para Google Gemini AI
let genAI = null;
let geminiModel = null;

// Middleware para JSON y CORS
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Inicializar IA generativa si hay API key disponible
async function initializeAI() {
  try {
    // Obtener configuración de la base de datos
    const response = await axios.get(`${DATABASE_SERVER_URL}/auto-response/config`);
    const config = response.data;
    
    // Si hay API key configurada, inicializar
    if (config && config.geminiApiKey) {
      genAI = new GoogleGenerativeAI(config.geminiApiKey);
      geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
      console.log('Google Gemini AI inicializado correctamente');
      return true;
    } else {
      console.log('No se encontró API key para Google Gemini AI');
      return false;
    }
  } catch (error) {
    console.error('Error al inicializar IA generativa:', error.message);
    return false;
  }
}

// Verificar si es horario laboral
function isBusinessHours(config) {
  if (!config) return true; // Si no hay configuración, asumir que siempre es horario laboral
  
  const now = new Date();
  const currentHour = now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
  const currentDay = now.getDay(); // 0: domingo, 1: lunes, ..., 6: sábado
  
  // Verificar si el día actual es un día laboral
  const workingDays = config.workingDays ? config.workingDays.split(',').map(d => parseInt(d)) : [1, 2, 3, 4, 5];
  if (!workingDays.includes(currentDay)) {
    return false;
  }
  
  // Verificar si la hora actual está dentro del horario laboral
  const businessStart = config.businessHoursStart || '09:00:00';
  const businessEnd = config.businessHoursEnd || '18:00:00';
  
  return currentHour >= businessStart && currentHour <= businessEnd;
}

// Generar respuesta automática con IA
async function generateAIResponse(message, contactName) {
  if (!geminiModel) {
    console.log('Modelo de IA no inicializado');
    return null;
  }
  
  try {
    const prompt = `
      Eres un asistente virtual profesional para una empresa. Has recibido un mensaje de WhatsApp de un cliente llamado "${contactName || 'Cliente'}".
      
      El mensaje es: "${message}"
      
      Por favor, genera una respuesta amable, profesional y útil que:
      1. Salude al cliente por su nombre
      2. Reconozca el contenido de su mensaje
      3. Proporcione información preliminar útil
      4. Mencione que un asesor le atenderá pronto para ayudarle más a fondo
      5. Agradezca su contacto
      
      La respuesta debe ser concisa (máximo 200 palabras) y en español.
    `;
    
    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    return text;
  } catch (error) {
    console.error('Error al generar respuesta con IA:', error);
    return null;
  }
}

// Analizar mensaje con IA
async function analyzeMessage(message) {
  if (!geminiModel) {
    console.log('Modelo de IA no inicializado');
    return null;
  }
  
  try {
    const prompt = `
      Analiza el siguiente mensaje de WhatsApp: "${message}"
      
      Proporciona la siguiente información en formato JSON:
      1. Sentimiento general (positivo, negativo o neutral)
      2. Intención principal del cliente (consulta, queja, solicitud, información, otro)
      3. Si hay alguna fecha mencionada (formato YYYY-MM-DD)
      4. Si hay alguna cantidad de dinero mencionada (valor numérico)
      5. Palabras clave importantes (máximo 5)
      6. Prioridad sugerida (alta, media, baja)
      7. Si requiere atención inmediata (true/false)
      8. Categoría sugerida para el mensaje
      
      Ejemplo de formato de respuesta:
      {
        "sentiment": "positivo",
        "intent": "consulta",
        "dates": ["2023-05-20"],
        "amounts": [1500],
        "keywords": ["producto", "entrega", "fecha"],
        "priority": "media",
        "needsImmediateAttention": false,
        "category": "ventas"
      }
    `;
    
    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Extraer JSON de la respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.error('Error al parsear JSON de análisis:', err);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error al analizar mensaje con IA:', error);
    return null;
  }
}

// === Rutas API ===

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'message-processor',
    timestamp: new Date().toISOString(),
    aiAvailable: geminiModel !== null
  });
});

// Procesar mensaje
app.post('/process-message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.chatId || message.from_me === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren los datos del mensaje: chatId y from_me'
      });
    }
    
    // Solo procesar mensajes entrantes (no enviados por nosotros)
    if (message.from_me) {
      return res.json({
        status: 'success',
        message: 'Mensaje propio, no requiere procesamiento',
        processingResult: null
      });
    }
    
    // Obtener configuración de respuestas automáticas
    let autoResponseConfig;
    try {
      const configResponse = await axios.get(`${DATABASE_SERVER_URL}/auto-response/config`);
      autoResponseConfig = configResponse.data;
    } catch (error) {
      console.error('Error al obtener configuración de respuestas automáticas:', error.message);
      autoResponseConfig = null;
    }
    
    // Inicializar resultado de procesamiento
    const processingResult = {
      timestamp: new Date().toISOString(),
      autoResponse: {
        enabled: autoResponseConfig?.enabled || false,
        sent: false,
        message: null,
        businessHours: isBusinessHours(autoResponseConfig)
      },
      analysis: null
    };
    
    // Si las respuestas automáticas están habilitadas, procesar
    if (autoResponseConfig?.enabled) {
      // Determinar qué mensaje enviar según horario
      let responseMessage;
      
      if (isBusinessHours(autoResponseConfig)) {
        // Obtener o generar mensaje de bienvenida
        const contactName = message.chatId.split('@')[0];
        
        // Intentar generar respuesta con IA si está configurada
        if (geminiModel) {
          responseMessage = await generateAIResponse(message.content, contactName);
        }
        
        // Si no se pudo generar con IA, usar mensaje predeterminado
        if (!responseMessage) {
          responseMessage = autoResponseConfig.greetingMessage || 
            'Gracias por contactarnos. En breve un asesor le atenderá.';
        }
      } else {
        // Mensaje fuera de horario
        responseMessage = autoResponseConfig.outOfHoursMessage || 
          'Gracias por su mensaje. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Le responderemos en cuanto estemos disponibles.';
      }
      
      // Guardar el mensaje de respuesta en el resultado
      processingResult.autoResponse.message = responseMessage;
      
      // Enviar respuesta automática a través del servidor de WhatsApp
      try {
        await axios.post(`${WHATSAPP_SERVER_URL}/send-message`, {
          accountId: message.accountId,
          chatId: message.chatId,
          message: responseMessage
        });
        
        processingResult.autoResponse.sent = true;
      } catch (error) {
        console.error('Error al enviar respuesta automática:', error.message);
        processingResult.autoResponse.sent = false;
        processingResult.autoResponse.error = error.message;
      }
    }
    
    // Analizar mensaje con IA si está disponible
    if (geminiModel) {
      const analysis = await analyzeMessage(message.content);
      processingResult.analysis = analysis;
    }
    
    // Guardar resultado del procesamiento en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/messages/${message.chatId}/${message.messageId}`, {
        processingStatus: 'processed',
        processingResult
      });
    } catch (dbError) {
      console.error('Error al guardar resultado de procesamiento:', dbError.message);
    }
    
    res.json({
      status: 'success',
      message: 'Mensaje procesado correctamente',
      processingResult
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

// Generar respuesta con IA
app.post('/generate-response', async (req, res) => {
  try {
    const { message, contactName } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el contenido del mensaje'
      });
    }
    
    // Verificar si IA está inicializada
    if (!geminiModel) {
      // Intentar inicializar
      const initialized = await initializeAI();
      
      if (!initialized) {
        return res.status(500).json({
          status: 'error',
          message: 'Google Gemini AI no está configurado correctamente'
        });
      }
    }
    
    // Generar respuesta
    const response = await generateAIResponse(message, contactName);
    
    if (!response) {
      return res.status(500).json({
        status: 'error',
        message: 'No se pudo generar una respuesta con IA'
      });
    }
    
    res.json({
      status: 'success',
      response
    });
  } catch (error) {
    console.error('Error al generar respuesta con IA:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar respuesta con IA',
      error: error.message
    });
  }
});

// Analizar mensaje con IA
app.post('/analyze-message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el contenido del mensaje'
      });
    }
    
    // Verificar si IA está inicializada
    if (!geminiModel) {
      // Intentar inicializar
      const initialized = await initializeAI();
      
      if (!initialized) {
        return res.status(500).json({
          status: 'error',
          message: 'Google Gemini AI no está configurado correctamente'
        });
      }
    }
    
    // Analizar mensaje
    const analysis = await analyzeMessage(message);
    
    if (!analysis) {
      return res.status(500).json({
        status: 'error',
        message: 'No se pudo analizar el mensaje con IA'
      });
    }
    
    res.json({
      status: 'success',
      analysis
    });
  } catch (error) {
    console.error('Error al analizar mensaje con IA:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al analizar mensaje con IA',
      error: error.message
    });
  }
});

// Configurar respuestas automáticas
app.post('/auto-response/config', async (req, res) => {
  try {
    const config = req.body;
    
    // Intentar actualizar en la base de datos
    try {
      const response = await axios.post(`${DATABASE_SERVER_URL}/auto-response/config`, config);
      
      // Si se actualizó la API key de Gemini, reinicializar
      if (config.geminiApiKey) {
        await initializeAI();
      }
      
      res.json({
        status: 'success',
        message: 'Configuración actualizada correctamente',
        config: response.data
      });
    } catch (error) {
      console.error('Error al actualizar configuración en BD:', error.message);
      res.status(500).json({
        status: 'error',
        message: 'Error al actualizar configuración',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error al configurar respuestas automáticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al configurar respuestas automáticas',
      error: error.message
    });
  }
});

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Procesador de mensajes iniciado en http://0.0.0.0:${PORT}`);
  
  // Inicializar IA al arrancar
  initializeAI().then(success => {
    if (success) {
      console.log('Google Gemini AI inicializado correctamente al arrancar');
    } else {
      console.log('No se pudo inicializar Google Gemini AI, se intentará más tarde');
    }
  });
});

// Manejar cierre de proceso
process.on('SIGINT', () => {
  console.log('Cerrando procesador de mensajes...');
  server.close(() => {
    console.log('Procesador de mensajes detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando procesador de mensajes...');
  server.close(() => {
    console.log('Procesador de mensajes detenido');
    process.exit(0);
  });
});