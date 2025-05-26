import { Request, Response, Router } from 'express';
import OpenAI from 'openai';

/**
 * R.A. AI SIMPLE QUE FUNCIONA
 * Sin complicaciones, directo con OpenAI
 */

const router = Router();
let isRAIActive = false;
let monitoringInterval: NodeJS.Timeout | null = null;

// Inicializar OpenAI con tu clave
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('✅ R.A. AI Simple inicializado con OpenAI');

/**
 * Activar/Desactivar R.A. AI
 */
router.post('/toggle', async (req: Request, res: Response) => {
  try {
    const { active } = req.body;
    isRAIActive = active;

    if (active) {
      startMonitoring();
      console.log('🔥 R.A. AI ACTIVADO Y FUNCIONANDO');
    } else {
      stopMonitoring();
      console.log('⏹️ R.A. AI DESACTIVADO');
    }

    res.json({
      success: true,
      active: isRAIActive,
      message: `R.A. AI ${active ? 'activado' : 'desactivado'}`
    });
  } catch (error) {
    console.error('❌ Error activando R.A. AI:', error);
    res.status(500).json({
      success: false,
      error: 'Error al activar R.A. AI'
    });
  }
});

/**
 * Procesar mensaje directo
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { messageText } = req.body;

    if (!isRAIActive) {
      return res.json({ success: false, error: 'R.A. AI no está activo' });
    }

    console.log(`🔄 Procesando: "${messageText}"`);
    
    const response = await generateResponse(messageText);
    
    console.log(`✅ Respuesta generada: "${response}"`);

    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando mensaje'
    });
  }
});

/**
 * Generar respuesta con OpenAI
 */
async function generateResponse(messageText: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // el modelo más nuevo de OpenAI
      messages: [
        {
          role: "system",
          content: "Eres un asistente de ventas profesional y amable. Responde de manera útil y comercial a las consultas de clientes. Sé breve y directo."
        },
        {
          role: "user",
          content: messageText
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    return completion.choices[0].message.content || "Gracias por tu mensaje. Te ayudo enseguida.";
  } catch (error) {
    console.error('❌ Error con OpenAI:', error);
    return "Gracias por tu mensaje. Un agente te contactará pronto.";
  }
}

/**
 * Iniciar monitoreo automático
 */
function startMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  console.log('🔄 Iniciando monitoreo automático...');
  
  monitoringInterval = setInterval(() => {
    if (isRAIActive) {
      checkForMessages();
    }
  }, 5000); // Cada 5 segundos
}

/**
 * Detener monitoreo
 */
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  console.log('⏹️ Monitoreo detenido');
}

/**
 * Verificar mensajes (simulación simple)
 */
async function checkForMessages() {
  try {
    console.log('🔍 R.A. AI verificando mensajes...');
    
    // Aquí pondrías la lógica real para obtener mensajes de WhatsApp
    // Por ahora, simula que encuentra un mensaje cada cierto tiempo
    const hasNewMessage = Math.random() > 0.95; // 5% probabilidad
    
    if (hasNewMessage) {
      const demoMessage = "Hola, ¿tienen productos disponibles?";
      console.log(`📨 NUEVO MENSAJE: "${demoMessage}"`);
      
      const response = await generateResponse(demoMessage);
      console.log(`🤖 RESPUESTA AUTOMÁTICA: "${response}"`);
    }
  } catch (error) {
    console.error('❌ Error verificando mensajes:', error);
  }
}

export default router;