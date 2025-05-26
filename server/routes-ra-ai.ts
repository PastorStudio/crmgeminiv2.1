import { Request, Response } from 'express';
import { directOpenaiResponder } from './services/directOpenaiResponder';

/**
 * Rutas para el sistema R.A. AI - completamente independiente
 */

// Activar/Desactivar R.A. AI
export function setupRAIRoutes(app: any, whatsappMultiAccountManager: any) {
  
  // Toggle R.A. AI
  app.post('/api/ra-ai/toggle', async (req: Request, res: Response) => {
    try {
      const { active } = req.body;
      
      directOpenaiResponder.setActive(active);
      
      res.json({
        success: true,
        active: directOpenaiResponder.isActive(),
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
      const status = directOpenaiResponder.getStatus();
      res.json({
        success: true,
        ...status
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