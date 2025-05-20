/**
 * Servidor Procesador de Mensajes - Microservicio independiente
 * 
 * Este microservicio procesa los mensajes de WhatsApp y utiliza
 * Google Gemini AI para generar respuestas inteligentes.
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();
const PORT = process.env.MESSAGE_PROCESSOR_PORT || 5002;

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// URL del servidor de base de datos
const DATABASE_SERVER_URL = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';

// Estado local del procesador
let processorStatus = {
  ready: true,
  aiConfigured: false,
  aiModel: null,
  lastError: null,
  processedMessages: 0,
  lastRequestTimestamp: null
};

// Middleware para log de solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Cargar configuración de AI desde la base de datos
async function loadAIConfiguration() {
  try {
    const response = await axios.get(`${DATABASE_SERVER_URL}/auto-response/config`);
    const config = response.data;
    
    if (config.geminiApiKey) {
      try {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        processorStatus.aiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        processorStatus.aiConfigured = true;
        console.log('Google Gemini AI configurado correctamente');
        return true;
      } catch (aiError) {
        console.error('Error al configurar Google Gemini AI:', aiError);
        processorStatus.lastError = {
          message: 'Error al configurar Google Gemini AI',
          error: aiError.toString(),
          timestamp: new Date().toISOString()
        };
        processorStatus.aiConfigured = false;
        return false;
      }
    } else {
      console.log('No se encontró clave API para Google Gemini AI');
      processorStatus.aiConfigured = false;
      return false;
    }
  } catch (error) {
    console.error('Error al cargar configuración de AI:', error);
    processorStatus.lastError = {
      message: 'Error al cargar configuración de AI',
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    return false;
  }
}

// Generar respuesta con Google Gemini AI
async function generateAIResponse(message, contactName) {
  if (!processorStatus.aiConfigured || !processorStatus.aiModel) {
    await loadAIConfiguration();
    if (!processorStatus.aiConfigured) {
      return {
        generated: false,
        message: "No se pudo configurar Google Gemini AI. Comprueba la clave API."
      };
    }
  }
  
  try {
    // Crear instrucciones para el modelo AI
    const instructions = `
    Eres un asistente de atención al cliente para WhatsApp. Responde con un mensaje breve, conciso y amable.
    
    El cliente se llama ${contactName || 'Cliente'} y ha enviado el siguiente mensaje:
    "${message}"
    
    Responde de forma profesional, orientada al servicio y sin exceder los 3 párrafos. 
    No menciones que eres una IA. Actúa como un representante de servicio al cliente real.
    
    Incluye siempre el nombre del cliente en la respuesta.
    
    Si el cliente está haciendo una pregunta específica, intenta responderla de manera concisa sin inventar información.
    Si no conoces la respuesta, indícale amablemente que su mensaje ha sido recibido y que un agente humano pronto le responderá con más detalles.
    `;
    
    // Generar respuesta con Google Gemini
    const result = await processorStatus.aiModel.generateContent(instructions);
    const response = result.response;
    const generatedText = response.text();
    
    processorStatus.processedMessages++;
    processorStatus.lastRequestTimestamp = new Date().toISOString();
    
    return {
      generated: true,
      message: generatedText
    };
  } catch (error) {
    console.error('Error al generar respuesta con Google Gemini AI:', error);
    processorStatus.lastError = {
      message: 'Error al generar respuesta con Google Gemini AI',
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    
    return {
      generated: false,
      message: "Lo siento, no pude generar una respuesta en este momento. Un agente te atenderá pronto.",
      error: error.message
    };
  }
}

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'message-processor',
    timestamp: new Date().toISOString(),
    aiConfigured: processorStatus.aiConfigured,
    processedMessages: processorStatus.processedMessages
  });
});

// Ruta para generar respuesta automática
app.post('/generate-response', async (req, res) => {
  try {
    const { message, contactName } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo message'
      });
    }
    
    const response = await generateAIResponse(message, contactName);
    
    res.json({
      status: response.generated ? 'success' : 'warning',
      response: response.message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al generar respuesta:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar respuesta',
      error: error.message
    });
  }
});

// Ruta para actualizar configuración de AI
app.post('/update-ai-config', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo apiKey'
      });
    }
    
    // Guardar la clave API en la base de datos
    await axios.post(`${DATABASE_SERVER_URL}/auto-response/config`, {
      geminiApiKey: apiKey
    });
    
    // Actualizar configuración local
    const configResult = await loadAIConfiguration();
    
    res.json({
      status: configResult ? 'success' : 'error',
      message: configResult 
        ? 'Configuración de Google Gemini AI actualizada correctamente' 
        : 'No se pudo configurar Google Gemini AI',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al actualizar configuración de AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar configuración de AI',
      error: error.message
    });
  }
});

// Ruta para verificar el estado de configuración de AI
app.get('/ai-config', async (req, res) => {
  try {
    await loadAIConfiguration();
    
    res.json({
      status: 'success',
      aiConfigured: processorStatus.aiConfigured,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al verificar configuración de AI:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al verificar configuración de AI',
      error: error.message
    });
  }
});

// Iniciar el servidor y cargar configuración inicial
(async () => {
  // Cargar configuración de AI al iniciar
  await loadAIConfiguration();
  
  // Iniciar servidor
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor Procesador de Mensajes iniciado en http://0.0.0.0:${PORT}`);
    if (processorStatus.aiConfigured) {
      console.log('✅ Google Gemini AI configurado correctamente');
    } else {
      console.log('⚠️ Google Gemini AI no configurado. Configure la clave API para habilitar respuestas automáticas inteligentes.');
    }
  });
  
  // Manejar señales de cierre
  process.on('SIGINT', () => {
    console.log('Cerrando servidor procesador de mensajes...');
    server.close(() => {
      console.log('Servidor procesador de mensajes detenido');
      process.exit(0);
    });
  });
  
  process.on('SIGTERM', () => {
    console.log('Cerrando servidor procesador de mensajes...');
    server.close(() => {
      console.log('Servidor procesador de mensajes detenido');
      process.exit(0);
    });
  });
})();