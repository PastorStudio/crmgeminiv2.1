/**
 * Servidor de Procesamiento de Mensajes - Microservicio independiente
 * 
 * Este servidor se encarga de procesar los mensajes recibidos
 * y generar respuestas utilizando Google Gemini AI.
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PROCESSOR_SERVER_PORT || 5002;

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Configuración de Google Gemini AI
let geminiApi = null;
let geminiModel = null;

// Dirección del servidor de base de datos
const DATABASE_SERVER_URL = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';

// Función para inicializar el modelo de IA
async function initializeAI() {
  try {
    // Verificar si ya tenemos una instancia de IA
    if (geminiApi && geminiModel) {
      return true;
    }
    
    // Obtener configuración de respuestas automáticas
    const response = await axios.get(`${DATABASE_SERVER_URL}/auto-response/config`);
    const config = response.data;
    
    // Verificar si tenemos una clave API
    const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log('No se encontró clave API para Google Gemini AI');
      return false;
    }
    
    // Inicializar Google Gemini
    geminiApi = new GoogleGenerativeAI(apiKey);
    geminiModel = geminiApi.getGenerativeModel({ model: 'gemini-pro' });
    
    console.log('Google Gemini AI inicializado exitosamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar Google Gemini AI:', error);
    return false;
  }
}

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware para manejar errores
app.use((err, req, res, next) => {
  console.error(`Error en ${req.method} ${req.url}:`, err);
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    error: err.message
  });
});

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'message-processor',
    aiInitialized: geminiApi !== null && geminiModel !== null,
    timestamp: new Date().toISOString()
  });
});

// Ruta para verificar estado de IA
app.get('/ai/status', async (req, res) => {
  const aiInitialized = await initializeAI();
  
  res.json({
    status: aiInitialized ? 'ok' : 'error',
    message: aiInitialized ? 'Google Gemini AI inicializado correctamente' : 'Google Gemini AI no inicializado',
    timestamp: new Date().toISOString()
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
    
    // Verificar si AI está inicializado
    const aiInitialized = await initializeAI();
    
    if (!aiInitialized) {
      return res.status(500).json({
        status: 'error',
        message: 'No se pudo inicializar Google Gemini AI. Verificar clave API.'
      });
    }
    
    // Obtener configuración de respuestas automáticas
    const response = await axios.get(`${DATABASE_SERVER_URL}/auto-response/config`);
    const config = response.data;
    
    // Verificar si las respuestas automáticas están habilitadas
    if (!config.enabled) {
      return res.json({
        status: 'warning',
        message: 'Respuestas automáticas deshabilitadas',
        response: null
      });
    }
    
    // Verificar si estamos en horario de atención
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo, 1 = lunes, ...
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Convertir el horario de atención a minutos
    const [startHour, startMinute] = config.businessHoursStart.split(':').map(Number);
    const [endHour, endMinute] = config.businessHoursEnd.split(':').map(Number);
    
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;
    
    // Verificar si el día actual está en días laborables
    const workingDays = config.workingDays.split(',').map(Number);
    const isWorkingDay = workingDays.includes(dayOfWeek);
    
    // Verificar si estamos en horario laborable
    const isBusinessHours = isWorkingDay && (currentTime >= startTimeMinutes && currentTime <= endTimeMinutes);
    
    // Si no estamos en horario laborable, devolver mensaje fuera de horario
    if (!isBusinessHours) {
      return res.json({
        status: 'success',
        message: 'Fuera de horario de atención',
        response: config.outOfHoursMessage
      });
    }
    
    // Construir prompt para Google Gemini AI
    const prompt = `
    Eres un asistente de atención al cliente profesional para una empresa que utiliza WhatsApp Business.
    
    Contexto:
    - Un cliente llamado "${contactName}" ha enviado el siguiente mensaje: "${message}"
    - Representa a la empresa de manera cortés y profesional
    - Responde de forma concisa (máximo 3 párrafos cortos)
    - Usa un tono conversacional y amigable
    - No uses emojis excesivos, máximo 1-2 en toda la respuesta
    - No des información falsa o inventada
    - Si no sabes algo, ofrece conectar al cliente con un agente humano
    - Siempre mantén la conversación abierta para que el cliente pueda seguir interactuando
    
    Instrucciones adicionales:
    - Responde siempre en español
    - Mantén un tono corporativo pero cercano
    - No menciones que eres una IA
    - Siempre sé profesional y útil
    
    Por favor, genera una respuesta apropiada:
    `;
    
    // Generar respuesta con Google Gemini
    const result = await geminiModel.generateContent(prompt);
    const response_text = result.response.text();
    
    res.json({
      status: 'success',
      message: 'Respuesta generada exitosamente',
      response: response_text.trim()
    });
  } catch (error) {
    console.error('Error al generar respuesta automática:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar respuesta automática',
      error: error.message
    });
  }
});

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor de Procesamiento iniciado en http://0.0.0.0:${PORT}`);
  
  // Inicializar AI al iniciar el servidor
  initializeAI().then((success) => {
    if (success) {
      console.log('Google Gemini AI inicializado exitosamente');
    } else {
      console.log('No se pudo inicializar Google Gemini AI. Verificar clave API.');
    }
  });
});

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('Cerrando servidor de Procesamiento...');
  server.close(() => {
    console.log('Servidor de Procesamiento detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor de Procesamiento...');
  server.close(() => {
    console.log('Servidor de Procesamiento detenido');
    process.exit(0);
  });
});