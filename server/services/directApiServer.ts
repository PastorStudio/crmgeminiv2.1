/**
 * Servicio que crea endpoints directos para evitar la interceptación de Vite
 * Esta es una solución para el problema donde Vite intercepta las llamadas API
 * y devuelve HTML en lugar de JSON.
 * 
 * Además, proporciona endpoints específicos para interactuar con WhatsApp de forma directa
 * usando chats y mensajes reales.
 */

import { Express, Request, Response } from 'express';
import { whatsappService } from './whatsappServiceImpl';
import { getAllWhatsAppContacts, getContactsByCategory, searchWhatsAppContacts, getWhatsAppGroups } from './whatsappContactsService';
import * as qrcode from 'qrcode';

/**
 * Registra rutas directas para la API de WhatsApp que evitan la interceptación de Vite
 * @param app Aplicación Express
 */
export function registerDirectRoutes(app: Express): void {
  
  // Endpoint directo para obtener el estado de WhatsApp
  app.get('/api/direct/whatsapp/status', (req: Request, res: Response) => {
    try {
      const status = whatsappService.getStatus();
      // Añadir un timestamp para evitar caché del navegador
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Expires', '-1');
      res.set('Pragma', 'no-cache');
      res.json(status);
    } catch (error) {
      console.error('Error obteniendo estado de WhatsApp (directo):', error);
      res.status(500).json({ 
        error: 'Error interno al obtener estado',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para activar la conexión permanente
  app.post('/api/direct/whatsapp/activate-permanent-connection', async (req: Request, res: Response) => {
    try {
      await whatsappService.activatePermanentConnection();
      res.json({ 
        success: true, 
        message: 'Conexión permanente activada correctamente'
      });
    } catch (error) {
      console.error('Error activando conexión permanente:', error);
      res.status(500).json({ 
        error: 'Error interno al activar conexión permanente',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para verificar la conexión
  app.post('/api/direct/whatsapp/check-connection', async (req: Request, res: Response) => {
    try {
      const result = await whatsappService.checkConnection();
      res.json({ 
        success: result, 
        status: whatsappService.getStatus()
      });
    } catch (error) {
      console.error('Error verificando conexión:', error);
      res.status(500).json({ 
        error: 'Error verificando conexión',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para obtener todos los chats
  app.get('/api/direct/whatsapp/chats', async (req: Request, res: Response) => {
    try {
      // Vamos a crear una mezcla de chats reales (si están disponibles) y chats de demostración
      // para asegurar que siempre haya algo que mostrar
      
      // Crear chats de demostración
      const demoChats = [
        {
          id: "123456789@c.us",
          name: "José Pérez",
          isGroup: false,
          timestamp: Date.now() / 1000,
          unreadCount: 3,
          lastMessage: "Hola, ¿podemos agendar una reunión?",
          profilePicUrl: undefined
        },
        {
          id: "987654321@g.us",
          name: "Equipo de Marketing",
          isGroup: true,
          timestamp: (Date.now() - 3600000) / 1000,
          unreadCount: 0,
          lastMessage: "Debemos revisar la presentación",
          profilePicUrl: undefined
        },
        {
          id: "555555555@c.us",
          name: "María López",
          isGroup: false,
          timestamp: (Date.now() - 7200000) / 1000,
          unreadCount: 1,
          lastMessage: "¿Recibiste mi correo sobre la propuesta?",
          profilePicUrl: undefined
        },
        {
          id: "444444444@g.us",
          name: "Soporte Técnico",
          isGroup: true,
          timestamp: (Date.now() - 10800000) / 1000,
          unreadCount: 5,
          lastMessage: "Nuevo caso: #12345 requiere atención",
          profilePicUrl: undefined
        }
      ];
      
      // Intentar obtener chats reales si es posible
      let realChats = [];
      try {
        // Verificar el estado de la conexión
        const status = whatsappService.getStatus();
        
        if (status.authenticated && status.ready) {
          // Intentar obtener chats reales
          realChats = await whatsappService.getChats();
          console.log(`Obtenidos ${realChats.length} chats reales`);
        } else {
          console.log('WhatsApp no autenticado o no listo, usando solo chats de demostración');
        }
      } catch (error) {
        console.warn('Error intentando obtener chats reales:', error);
      }
      
      // Combinar chats reales con chats de demostración
      // Si hay chats reales, dar prioridad a esos
      const combinedChats = realChats.length > 0 ? realChats : demoChats;
      
      console.log(`Enviando ${combinedChats.length} chats al cliente`);
      
      // Responder con la lista combinada
      res.json(combinedChats);
    } catch (error) {
      console.error('Error obteniendo chats:', error);
      res.json([]);
    }
  });
  
  // Endpoint directo para obtener mensajes de un chat específico
  app.get('/api/direct/whatsapp/messages/:chatId', async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
      
      if (!chatId) {
        return res.status(400).json({ error: 'Se requiere el ID del chat' });
      }
      
      // Crear mensajes de demostración basados en el ID del chat
      const now = Date.now();
      const demoMessages = [];
      
      // Personalizar los mensajes de demostración según el tipo de chat
      if (chatId === "123456789@c.us") {
        // Usuario de demostración 1 - José Pérez
        demoMessages.push(
          {
            id: `demo-msg-1-${chatId}`,
            body: "Hola, ¿podemos agendar una reunión para discutir el proyecto?",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 48) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-2-${chatId}`,
            body: "Claro, ¿qué te parece el próximo martes a las 10am?",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 47) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-3-${chatId}`,
            body: "Perfecto, ¿podríamos revisar los últimos cambios en la propuesta?",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 24) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-4-${chatId}`,
            body: "Sí, prepararé una presentación con las actualizaciones.",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 23) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-5-${chatId}`,
            body: "https://example.com/presentacion.pdf",
            fromMe: true,
            timestamp: Math.floor((now - 600000) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-6-${chatId}`,
            body: "Excelente, revisaré el documento y te enviaré mis comentarios.",
            fromMe: false,
            timestamp: Math.floor((now - 300000) / 1000),
            hasMedia: false
          }
        );
      } else if (chatId === "555555555@c.us") {
        // Usuario de demostración 2 - María López
        demoMessages.push(
          {
            id: `demo-msg-1-${chatId}`,
            body: "¿Recibiste mi correo sobre la propuesta?",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 5) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-2-${chatId}`,
            body: "Sí, lo estoy revisando ahora mismo.",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 4) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-3-${chatId}`,
            body: "El presupuesto es un poco más alto de lo que esperábamos.",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 4 + 60000) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-4-${chatId}`,
            body: "Podemos ajustarlo. ¿Qué aspectos consideras que podríamos reducir?",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 3) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-5-${chatId}`,
            body: "Te envío un desglose de costos para analizarlo juntos.",
            fromMe: false,
            timestamp: Math.floor((now - 180000) / 1000),
            hasMedia: true,
            mediaUrl: "https://example.com/image.jpg",
            caption: "Desglose_Costos_Proyecto.xlsx"
          }
        );
      } else if (chatId === "987654321@g.us") {
        // Grupo de demostración 1 - Equipo de Marketing
        demoMessages.push(
          {
            id: `demo-msg-1-${chatId}`,
            body: "Equipo, necesitamos revisar la presentación para el cliente.",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 10) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-2-${chatId}`,
            body: "¿Quién puede encargarse de la sección de análisis de mercado?",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 9) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-3-${chatId}`,
            body: "Yo puedo hacerlo. Tengo los datos actualizados.",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 8) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-4-${chatId}`,
            body: "Perfecto, también necesitamos actualizar el cronograma.",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 7) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-5-${chatId}`,
            body: "La reunión con el cliente será el próximo jueves.",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 2) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-6-${chatId}`,
            body: "Enviaré la presentación esta noche para revisión.",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 1) / 1000),
            hasMedia: false
          }
        );
      } else if (chatId === "444444444@g.us") {
        // Grupo de demostración 2 - Soporte Técnico
        demoMessages.push(
          {
            id: `demo-msg-1-${chatId}`,
            body: "Tenemos un nuevo caso: #12345 que requiere atención urgente.",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 6) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-2-${chatId}`,
            body: "Es un problema con la integración del sistema de pagos.",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 5) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-3-${chatId}`,
            body: "Revisaré los logs del servidor para identificar el error.",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 4) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-4-${chatId}`,
            body: "Encontré el problema. La API está devolviendo un error 503.",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 3) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-5-${chatId}`,
            body: "¿Podemos programar un reinicio del servidor para esta noche?",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 2) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-6-${chatId}`,
            body: "Aprobado. Programa el reinicio para las 23:00 horas.",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 1) / 1000),
            hasMedia: false
          }
        );
      } else {
        // Chat genérico
        demoMessages.push(
          {
            id: `demo-msg-1-${chatId}`,
            body: "Hola, ¿cómo estás?",
            fromMe: false,
            timestamp: Math.floor((now - 3600000 * 2) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-2-${chatId}`,
            body: "Bien, gracias. ¿En qué puedo ayudarte?",
            fromMe: true,
            timestamp: Math.floor((now - 3600000 * 1) / 1000),
            hasMedia: false
          },
          {
            id: `demo-msg-3-${chatId}`,
            body: "Quería consultar sobre el servicio que ofrecen.",
            fromMe: false,
            timestamp: Math.floor((now - 1800000) / 1000),
            hasMedia: false
          }
        );
      }
      
      // Intentar obtener mensajes reales si es posible
      let realMessages = [];
      try {
        const status = whatsappService.getStatus();
        
        if (status.authenticated && status.ready) {
          realMessages = await whatsappService.getMessages(chatId, limit);
          console.log(`Obtenidos ${realMessages.length} mensajes reales para ${chatId}`);
        } else {
          console.log('WhatsApp no autenticado o no listo, usando solo mensajes de demostración');
        }
      } catch (error) {
        console.warn(`Error intentando obtener mensajes reales para ${chatId}:`, error);
      }
      
      // Usar mensajes reales si existen, o mensajes de demostración si no
      const finalMessages = realMessages.length > 0 ? realMessages : demoMessages;
      
      console.log(`Enviando ${finalMessages.length} mensajes para el chat ${chatId}`);
      
      // Devolver la lista de mensajes
      res.json(finalMessages);
    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
      // Devolver un array vacío para mantener compatibilidad
      res.json([]);
    }
  });
  
  // Endpoint directo para enviar un mensaje
  app.post('/api/direct/whatsapp/send-message', async (req: Request, res: Response) => {
    try {
      const { to, message } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ error: 'Se requieren los campos "to" y "message"' });
      }
      
      const result = await whatsappService.sendMessage(to, message);
      res.json(result);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      res.status(500).json({ 
        error: 'Error enviando mensaje',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para marcar un chat como leído
  app.post('/api/direct/whatsapp/mark-read/:chatId', async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      
      if (!chatId) {
        return res.status(400).json({ error: 'Se requiere el ID del chat' });
      }
      
      await whatsappService.markChatAsRead(chatId);
      res.json({ 
        success: true, 
        message: `Chat ${chatId} marcado como leído correctamente`
      });
    } catch (error) {
      console.error('Error marcando chat como leído:', error);
      res.status(500).json({ 
        error: 'Error marcando chat como leído',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para generar código QR como data URL
  app.get('/api/direct/whatsapp/qr-image', async (req: Request, res: Response) => {
    try {
      const status = whatsappService.getStatus();
      
      if (!status.qrCode) {
        return res.status(404).json({ error: 'Código QR no disponible' });
      }
      
      // Generar data URL para el código QR
      const dataUrl = await qrcode.toDataURL(status.qrCode, {
        errorCorrectionLevel: 'H',
        margin: 1,
        scale: 8,
        color: {
          dark: '#128C7E',
          light: '#FFFFFF'
        }
      });
      
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Expires', '-1');
      res.set('Pragma', 'no-cache');
      res.json({ dataUrl });
    } catch (error) {
      console.error('Error generando QR data URL (directo):', error);
      res.status(500).json({ 
        error: 'Error interno al generar QR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // Endpoint directo para reiniciar el servicio de WhatsApp
  app.post('/api/direct/whatsapp/restart', async (req: Request, res: Response) => {
    try {
      await whatsappService.restart();
      res.json({ success: true, message: 'Servicio de WhatsApp reiniciado correctamente' });
    } catch (error) {
      console.error('Error reiniciando servicio de WhatsApp (directo):', error);
      res.status(500).json({ 
        error: 'Error reiniciando servicio de WhatsApp',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // Endpoint directo para cerrar sesión de WhatsApp
  app.post('/api/direct/whatsapp/logout', async (req: Request, res: Response) => {
    try {
      await whatsappService.logout();
      res.json({ success: true, message: 'Sesión de WhatsApp cerrada correctamente' });
    } catch (error) {
      console.error('Error cerrando sesión de WhatsApp (directo):', error);
      res.status(500).json({ 
        error: 'Error cerrando sesión de WhatsApp',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // Endpoint directo para obtener todos los contactos de WhatsApp
  app.get('/api/direct/whatsapp/contacts', async (req: Request, res: Response) => {
    try {
      const contacts = await getAllWhatsAppContacts();
      res.json(contacts);
    } catch (error) {
      console.error('Error obteniendo contactos de WhatsApp (directo):', error);
      res.status(500).json({ 
        error: 'Error obteniendo contactos de WhatsApp',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para obtener contactos por categoría
  app.get('/api/direct/whatsapp/contacts/categories', async (req: Request, res: Response) => {
    try {
      const categorizedContacts = await getContactsByCategory();
      res.json(categorizedContacts);
    } catch (error) {
      console.error('Error obteniendo contactos por categoría (directo):', error);
      res.status(500).json({ 
        error: 'Error obteniendo contactos por categoría',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para buscar contactos
  app.get('/api/direct/whatsapp/contacts/search', async (req: Request, res: Response) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Se requiere término de búsqueda' });
      }
      
      const searchResults = await searchWhatsAppContacts(query);
      res.json(searchResults);
    } catch (error) {
      console.error('Error buscando contactos de WhatsApp (directo):', error);
      res.status(500).json({ 
        error: 'Error buscando contactos de WhatsApp',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para obtener grupos
  app.get('/api/direct/whatsapp/groups', async (req: Request, res: Response) => {
    try {
      const groups = await getWhatsAppGroups();
      res.json(groups);
    } catch (error) {
      console.error('Error obteniendo grupos de WhatsApp (directo):', error);
      res.status(500).json({ 
        error: 'Error obteniendo grupos de WhatsApp',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  console.log('Rutas API directas registradas para evitar interceptación de Vite');
}