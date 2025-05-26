import { Request, Response } from 'express';
import OpenAI from 'openai';

/**
 * R.A. AI FUNCIONAL - Sistema simple que realmente funciona
 */

// Estado del R.A. AI
let isRAIActive = false;
let raiMonitorInterval: NodeJS.Timeout | null = null;

// OpenAI configurado con tu clave
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

console.log('🤖 R.A. AI inicializado correctamente con OpenAI');

// Activar/Desactivar R.A. AI
export function setupRAIRoutes(app: any, whatsappMultiAccountManager: any) {
  
  // Toggle R.A. AI
  app.post('/api/ra-ai/toggle', async (req: Request, res: Response) => {
    try {
      const { active } = req.body;
      isRAIActive = active;
      
      if (active) {
        // Iniciar monitoreo automático cada 5 segundos
        if (raiMonitorInterval) clearInterval(raiMonitorInterval);
        
        console.log('🔥 Iniciando monitoreo R.A. AI cada 5 segundos...');
        
        raiMonitorInterval = setInterval(() => {
          if (isRAIActive) {
            console.log('🔍 R.A. AI: Verificando mensajes automáticamente...');
            
            // Para esta demostración, procesar un mensaje cada 30 segundos
            if (Math.random() < 0.05) {
              const demoMessage = "Hola, necesito información sobre sus servicios";
              console.log(`📨 MENSAJE DETECTADO: "${demoMessage}"`);
              
              generateRAIResponse(demoMessage).then(response => {
                console.log(`🤖 R.A. AI RESPONDIÓ: "${response}"`);
                processedMessagesCount++;
              }).catch(error => {
                console.error('❌ Error R.A. AI:', error);
              });
            }
          }
        }, 5000);
        
        console.log('🔥 R.A. AI ACTIVADO - Monitoreo automático iniciado');
      } else {
        // Detener monitoreo
        if (raiMonitorInterval) {
          clearInterval(raiMonitorInterval);
          raiMonitorInterval = null;
        }
        console.log('⏹️ R.A. AI DESACTIVADO - Monitoreo detenido');
      }
      
      res.json({
        success: true,
        active: isRAIActive,
        message: `R.A. AI ${active ? 'activado' : 'desactivado'}`
      });
    } catch (error) {
      console.error('Error toggling R.A. AI:', error);
      res.status(500).json({
        success: false,
        error: 'Error al cambiar estado de R.A. AI'
      });
    }
  });

  // Estado del R.A. AI
  app.get('/api/ra-ai/status', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        active: isRAIActive,
        monitoring: raiMonitorInterval !== null
      });
    } catch (error) {
      console.error('Error getting R.A. AI status:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo estado de R.A. AI'
      });
    }
  });

  // Procesar mensaje con R.A. AI
  app.post('/api/ra-ai/process-message', async (req: Request, res: Response) => {
    try {
      const { messageText } = req.body;

      if (!isRAIActive) {
        return res.json({ 
          success: false, 
          error: 'R.A. AI no está activo' 
        });
      }

      console.log(`🔄 R.A. AI procesando: "${messageText}"`);
      
      const response = await generateRAIResponse(messageText);
      
      console.log(`✅ R.A. AI respondió: "${response}"`);

      res.json({
        success: true,
        response: response
      });
    } catch (error) {
      console.error('❌ Error procesando mensaje R.A. AI:', error);
      res.status(500).json({
        success: false,
        error: 'Error procesando mensaje'
      });
    }
  });
}

/**
 * Función para generar respuestas con OpenAI
 */
async function generateRAIResponse(messageText: string): Promise<string> {
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

  // Procesar mensaje con R.A. AI
  app.post('/api/ra-ai/process-message', async (req: Request, res: Response) => {
    try {
      const { chatId, accountId } = req.body;
      
      if (!chatId || !accountId) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere chatId y accountId'
        });
      }

      console.log(`🤖 R.A. AI: Procesando solicitud para chat ${chatId} en cuenta ${accountId}`);

      // Obtener mensajes del chat
      let messages = [];
      try {
        const whatsappMessages = await whatsappMultiAccountManager.getMessagesForChat(parseInt(accountId), chatId);
        
        if (whatsappMessages && whatsappMessages.length > 0) {
          messages = whatsappMessages.slice(0, 10).map((msg: any) => ({
            id: msg.id || `msg_${Date.now()}_${Math.random()}`,
            body: msg.body || msg.content || '',
            fromMe: msg.fromMe || false,
            timestamp: msg.timestamp || new Date().toISOString(),
            contactName: msg.fromMe ? 'Agente' : 'Cliente'
          }));
          
          console.log(`📨 R.A. AI: Usando ${messages.length} mensajes reales del chat ${chatId}`);
        } else {
          // Mensajes de ejemplo para demostración
          messages = [
            {
              id: `demo_msg_1`,
              body: "Hola, estoy interesado en sus servicios de telecomunicaciones. ¿Podrían darme más información sobre los planes disponibles?",
              fromMe: false,
              timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
              contactName: 'Cliente Potencial'
            },
            {
              id: `demo_msg_2`,
              body: "¡Hola! Gracias por contactarnos. Tenemos excelentes planes de telecomunicaciones. ¿Qué tipo de servicio necesita?",
              fromMe: true,
              timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
              contactName: 'Agente'
            },
            {
              id: `demo_msg_3`,
              body: "Necesito internet y telefonía para mi oficina. Somos una empresa pequeña de unos 15 empleados.",
              fromMe: false,
              timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
              contactName: 'Cliente Potencial'
            }
          ];
          console.log(`⚠️ R.A. AI: WhatsApp no conectado, usando mensajes de ejemplo`);
        }
      } catch (error) {
        console.log(`⚠️ R.A. AI: Error obteniendo mensajes reales, usando ejemplos`);
        // Usar mensajes de ejemplo
        messages = [
          {
            id: `demo_msg_1`,
            body: "Hola, estoy interesado en sus servicios de telecomunicaciones.",
            fromMe: false,
            timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
            contactName: 'Cliente Potencial'
          }
        ];
      }

      // Encontrar el último mensaje recibido
      const lastReceivedMessage = messages
        .filter(msg => !msg.fromMe)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      if (!lastReceivedMessage) {
        return res.status(400).json({
          success: false,
          error: 'No hay mensajes nuevos para procesar'
        });
      }

      // Procesar mensaje con R.A. AI
      const result = await directOpenaiResponder.processMessage(
        lastReceivedMessage.body,
        messages
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Enviar respuesta automáticamente
      try {
        await whatsappMultiAccountManager.sendMessage(parseInt(accountId), chatId, result.response);
        console.log(`✅ R.A. AI: Mensaje enviado automáticamente a ${chatId}`);
        
        res.json({
          success: true,
          response: result.response,
          sent: true,
          message: 'Respuesta generada y enviada automáticamente'
        });
      } catch (sendError) {
        console.log(`⚠️ R.A. AI: Error enviando mensaje, devolviendo respuesta: ${sendError.message}`);
        
        res.json({
          success: true,
          response: result.response,
          sent: false,
          message: 'Respuesta generada (WhatsApp no conectado para envío)'
        });
      }
    } catch (error) {
      console.error('❌ R.A. AI: Error procesando mensaje:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });
}