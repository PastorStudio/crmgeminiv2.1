/**
 * Message Processor Service
 * Servicio dedicado al procesamiento de mensajes, análisis y respuestas automáticas
 * Utiliza IA para generar respuestas y analizar contenido
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');

// Configuración básica
const app = express();
const PORT = process.env.PROCESSOR_SERVER_PORT || 5002;
const httpServer = createServer(app);

// Configuración de middleware
app.use(express.json());
app.use(cors());

// Configuración de WebSocket para comunicación con otros servidores
const internalWss = new WebSocketServer({ server: httpServer, path: '/internal-ws' });

// Configuración de servidores
const API_SERVER = process.env.API_SERVER || 'http://localhost:5000';
const WHATSAPP_SERVER = process.env.WHATSAPP_SERVER || 'http://localhost:5001';
const DATABASE_SERVER = process.env.DATABASE_SERVER || 'http://localhost:5003';

// Configuración de IA
let geminiClient = null;
let openaiClient = null;
let aiConfig = {
  autoResponse: false,
  defaultModel: 'gemini', // 'gemini' o 'openai'
  confidenceThreshold: 0.75,
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY
};

// Inicialización de clientes AI
async function initializeAI() {
  try {
    // Obtener configuración desde la base de datos
    try {
      const response = await axios.get(`${DATABASE_SERVER}/ai-config`);
      if (response.data) {
        aiConfig = { ...aiConfig, ...response.data };
      }
    } catch (dbError) {
      console.warn('Error obteniendo configuración AI desde la base de datos:', dbError.message);
    }

    // Inicializar Gemini si hay clave API
    if (aiConfig.geminiApiKey) {
      try {
        geminiClient = new GoogleGenerativeAI(aiConfig.geminiApiKey);
        console.log('Cliente Gemini inicializado correctamente');
        
        // Verificar clave API
        const model = geminiClient.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hello');
        console.log('Conexión a Gemini verificada correctamente');
      } catch (error) {
        console.error('Error inicializando Gemini:', error.message);
        
        if (error.message && error.message.includes('404')) {
          console.warn('ADVERTENCIA: La clave GEMINI_API_KEY parece ser una clave de cliente, no de servidor.');
          console.warn('Esto puede causar errores 404 en las llamadas a la API desde el servidor.');
        }
      }
    } else {
      console.warn('No se encontró clave API para Gemini');
    }

    // Inicializar OpenAI si hay clave API
    if (aiConfig.openaiApiKey) {
      try {
        openaiClient = new OpenAI({ apiKey: aiConfig.openaiApiKey });
        console.log('Cliente OpenAI inicializado correctamente');
        
        // Verificar clave API
        const completion = await openaiClient.chat.completions.create({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-3.5-turbo'
        });
        console.log('Conexión a OpenAI verificada correctamente');
      } catch (error) {
        console.error('Error inicializando OpenAI:', error.message);
      }
    } else {
      console.warn('No se encontró clave API para OpenAI');
    }

    return {
      gemini: !!geminiClient,
      openai: !!openaiClient
    };
  } catch (error) {
    console.error('Error general inicializando AI:', error);
    return {
      gemini: false,
      openai: false,
      error: error.message
    };
  }
}

// Genera una respuesta usando IA
async function generateResponse(messageText, contactName, messageInfo = {}) {
  if (!geminiClient && !openaiClient) {
    console.error('No hay clientes de IA disponibles para generar respuesta');
    return {
      success: false,
      error: 'No hay servicios de IA configurados'
    };
  }

  const clientToUse = aiConfig.defaultModel === 'openai' && openaiClient 
    ? 'openai' 
    : 'gemini';

  try {
    if (clientToUse === 'gemini' && geminiClient) {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `Eres un asistente virtual para una empresa que se comunica a través de WhatsApp.
Has recibido un mensaje de ${contactName || 'un contacto'}.
El mensaje es: "${messageText}"

Genera una respuesta amable, profesional y útil que sea apropiada para WhatsApp.
La respuesta debe ser clara, concisa (máximo 3 párrafos) y orientada a solucionar las necesidades del cliente.
Usa lenguaje cotidiano, evita tecnicismos y mantén un tono cercano.

Si el mensaje contiene preguntas sobre horarios, precios o servicios, indica que proporcionarás la información y/o que un agente de atención al cliente se pondrá en contacto pronto.
Si es un saludo o introducción, responde de manera cordial y pregunta en qué puedes ayudar.

IMPORTANTE: No inventes información específica sobre la empresa. No menciones que eres una IA a menos que te lo pregunten directamente.

Tu respuesta:`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      return {
        success: true,
        text: response,
        model: 'gemini-pro',
        provider: 'gemini',
        confidence: 0.85 // Estimación de confianza
      };
    } 
    else if (clientToUse === 'openai' && openaiClient) {
      const completion = await openaiClient.chat.completions.create({
        messages: [
          { role: 'system', content: `Eres un asistente virtual para una empresa que se comunica a través de WhatsApp.
Debes generar respuestas amables, profesionales y útiles que sean apropiadas para WhatsApp.
Tus respuestas deben ser claras, concisas (máximo 3 párrafos) y orientadas a solucionar las necesidades del cliente.
Usa lenguaje cotidiano, evita tecnicismos y mantén un tono cercano.

Si el mensaje contiene preguntas sobre horarios, precios o servicios, indica que proporcionarás la información y/o que un agente de atención al cliente se pondrá en contacto pronto.
Si es un saludo o introducción, responde de manera cordial y pregunta en qué puedes ayudar.

IMPORTANTE: No inventes información específica sobre la empresa. No menciones que eres una IA a menos que te lo pregunten directamente.` },
          { role: 'user', content: `He recibido este mensaje de ${contactName || 'un contacto'}: "${messageText}"

¿Cómo debería responder?` }
        ],
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 300
      });
      
      const response = completion.choices[0].message.content;
      
      return {
        success: true,
        text: response,
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        confidence: completion.choices[0].finish_reason === 'stop' ? 0.9 : 0.7
      };
    } 
    else {
      return {
        success: false,
        error: 'No hay modelo de IA disponible para generar respuesta'
      };
    }
  } catch (error) {
    console.error('Error generando respuesta con IA:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Procesa un mensaje entrante
async function processMessage(message, accountInfo) {
  // Registrar en log
  console.log(`Procesando mensaje de ${message.from} en cuenta ${accountInfo.id} (${accountInfo.name})`);
  
  try {
    // Verificar si es un mensaje entrante (no enviado por nosotros)
    if (message.fromMe) {
      return {
        processed: true,
        autoResponse: false,
        reason: 'Mensaje enviado por nosotros, no requiere respuesta automática'
      };
    }

    // Guardar mensaje en la base de datos
    try {
      await axios.post(`${DATABASE_SERVER}/messages`, {
        accountId: accountInfo.id,
        message
      });
    } catch (dbError) {
      console.error('Error guardando mensaje en la base de datos:', dbError.message);
    }

    // Verificar si la respuesta automática está activada
    if (!aiConfig.autoResponse) {
      return {
        processed: true,
        autoResponse: false,
        reason: 'Respuesta automática desactivada'
      };
    }

    // Extraer nombre de contacto
    let contactName = 'Cliente';
    if (message.from) {
      try {
        // Obtener información de contacto desde la base de datos
        const response = await axios.get(`${DATABASE_SERVER}/contacts/by-phone/${message.from}`);
        if (response.data && response.data.name) {
          contactName = response.data.name;
        }
      } catch (contactError) {
        console.warn('Error obteniendo información de contacto:', contactError.message);
      }
    }

    // Generar respuesta automática
    const responseResult = await generateResponse(message.body, contactName, {
      from: message.from,
      accountId: accountInfo.id
    });

    if (responseResult.success) {
      // Enviar respuesta automática
      try {
        const sendResponse = await axios.post(`${WHATSAPP_SERVER}/send`, {
          clientId: accountInfo.id,
          to: message.from,
          message: responseResult.text
        });

        return {
          processed: true,
          autoResponse: true,
          responseText: responseResult.text,
          provider: responseResult.provider,
          model: responseResult.model,
          confidence: responseResult.confidence,
          sendStatus: sendResponse.data
        };
      } catch (sendError) {
        console.error('Error enviando respuesta automática:', sendError.message);
        return {
          processed: true,
          autoResponse: false,
          responseGenerated: true,
          error: sendError.message
        };
      }
    } else {
      return {
        processed: true,
        autoResponse: false,
        error: responseResult.error
      };
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    return {
      processed: false,
      error: error.message
    };
  }
}

// API Routes

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'processor',
    ai: {
      gemini: !!geminiClient,
      openai: !!openaiClient,
      autoResponse: aiConfig.autoResponse
    }
  });
});

// Endpoint para activar/desactivar respuesta automática
app.post('/auto-response/toggle', async (req, res) => {
  const { enabled } = req.body;
  
  aiConfig.autoResponse = !!enabled;
  
  // Guardar configuración en la base de datos
  try {
    await axios.post(`${DATABASE_SERVER}/ai-config/update`, {
      autoResponse: aiConfig.autoResponse
    });
  } catch (dbError) {
    console.warn('Error guardando configuración en la base de datos:', dbError.message);
  }
  
  res.json({
    success: true,
    autoResponse: aiConfig.autoResponse
  });
});

// Endpoint para procesar un mensaje
app.post('/process-message', async (req, res) => {
  const { accountId, accountName, message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Se requiere el campo message' });
  }
  
  const result = await processMessage(message, { id: accountId, name: accountName });
  res.json(result);
});

// Endpoint para generar respuestas
app.post('/generate-response', async (req, res) => {
  const { message, contactName, messageInfo } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Se requiere el campo message' });
  }
  
  const result = await generateResponse(message, contactName, messageInfo);
  res.json(result);
});

// Endpoint para analizar un mensaje
app.post('/analyze', async (req, res) => {
  const { text, type = 'sentiment' } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Se requiere el campo text' });
  }
  
  if (!geminiClient && !openaiClient) {
    return res.status(503).json({ error: 'No hay servicios de IA disponibles' });
  }
  
  try {
    let result;
    
    if (aiConfig.defaultModel === 'openai' && openaiClient) {
      // Análisis con OpenAI
      const prompt = type === 'sentiment' 
        ? `Analiza el siguiente texto e identifica el sentimiento predominante (positivo, negativo o neutro) y su intensidad (1-10). También extrae palabras clave e intenciones del usuario. Texto: "${text}"`
        : `Analiza el siguiente texto e identifica la intención del usuario, posibles dudas, y clasifica la prioridad (alta, media, baja) como lead. Texto: "${text}"`;
      
      const completion = await openaiClient.chat.completions.create({
        messages: [
          { role: 'system', content: 'Eres un asistente de análisis de texto especializado en mensajes de WhatsApp.' },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-3.5-turbo',
        response_format: { type: 'json_object' }
      });
      
      try {
        result = JSON.parse(completion.choices[0].message.content);
        result.provider = 'openai';
      } catch (parseError) {
        result = {
          provider: 'openai',
          analysis: completion.choices[0].message.content,
          error: 'Formato incorrecto'
        };
      }
    } else if (geminiClient) {
      // Análisis con Gemini
      const model = geminiClient.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = type === 'sentiment' 
        ? `Analiza el siguiente texto e identifica el sentimiento predominante (positivo, negativo o neutro) y su intensidad (1-10). También extrae palabras clave e intenciones del usuario. Responde en formato JSON con las propiedades: sentiment, intensity, keywords, intent.

Texto a analizar: "${text}"

Respuesta JSON:`
        : `Analiza el siguiente texto e identifica la intención del usuario, posibles dudas, y clasifica la prioridad (alta, media, baja) como lead. Responde en formato JSON con las propiedades: intent, questions, priority, reason.

Texto a analizar: "${text}"

Respuesta JSON:`;
      
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      try {
        result = JSON.parse(response);
        result.provider = 'gemini';
      } catch (parseError) {
        result = {
          provider: 'gemini',
          analysis: response,
          error: 'Formato incorrecto'
        };
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error en análisis con IA:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener claves API
app.get('/api-keys/status', async (req, res) => {
  res.json({
    gemini: !!geminiClient,
    openai: !!openaiClient,
    defaultModel: aiConfig.defaultModel
  });
});

// Endpoint para actualizar claves API
app.post('/api-keys/update', async (req, res) => {
  const { geminiApiKey, openaiApiKey, defaultModel } = req.body;
  
  let updated = false;
  
  if (geminiApiKey) {
    aiConfig.geminiApiKey = geminiApiKey;
    updated = true;
  }
  
  if (openaiApiKey) {
    aiConfig.openaiApiKey = openaiApiKey;
    updated = true;
  }
  
  if (defaultModel && ['gemini', 'openai'].includes(defaultModel)) {
    aiConfig.defaultModel = defaultModel;
    updated = true;
  }
  
  if (updated) {
    // Reinicializar clientes
    await initializeAI();
    
    // Guardar configuración en la base de datos
    try {
      await axios.post(`${DATABASE_SERVER}/ai-config/update`, {
        geminiApiKey: aiConfig.geminiApiKey,
        openaiApiKey: aiConfig.openaiApiKey,
        defaultModel: aiConfig.defaultModel
      });
    } catch (dbError) {
      console.warn('Error guardando configuración en la base de datos:', dbError.message);
    }
  }
  
  res.json({
    success: true,
    updated,
    status: {
      gemini: !!geminiClient,
      openai: !!openaiClient,
      defaultModel: aiConfig.defaultModel
    }
  });
});

// WebSocket para comunicación interna entre servidores
internalWss.on('connection', (ws) => {
  console.log('Nueva conexión interna establecida con otro servidor');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Mensaje recibido desde otro servidor:', data.type);
      
      // Manejar diferentes tipos de mensajes
      if (data.type === 'process_message') {
        const result = await processMessage(data.message, data.account);
        ws.send(JSON.stringify({
          type: 'process_result',
          messageId: data.message.id,
          result
        }));
      }
      
      if (data.type === 'generate_response') {
        const result = await generateResponse(data.message, data.contactName);
        ws.send(JSON.stringify({
          type: 'generate_result',
          result
        }));
      }
      
      if (data.type === 'update_config') {
        aiConfig = { ...aiConfig, ...data.config };
      }
    } catch (error) {
      console.error('Error procesando mensaje interno:', error);
    }
  });
});

// Iniciar servidor
httpServer.listen(PORT, async () => {
  console.log(`Message Processor Server corriendo en http://localhost:${PORT}`);
  
  // Inicializar clientes AI
  const aiStatus = await initializeAI();
  console.log('Estado de servicios AI:', aiStatus);
});