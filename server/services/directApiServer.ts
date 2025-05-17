/**
 * Servicio que crea endpoints directos para evitar la interceptación de Vite
 * Esta es una solución para el problema donde Vite intercepta las llamadas API
 * y devuelve HTML en lugar de JSON.
 * 
 * Además, proporciona endpoints específicos para interactuar con WhatsApp de forma directa
 * usando SOLAMENTE chats y mensajes reales.
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
      // Verificar el estado de la conexión
      const status = whatsappService.getStatus();
      
      if (status.authenticated && status.ready) {
        // Obtener chats reales
        const chats = await whatsappService.getChats();
        console.log(`Obtenidos ${chats.length} chats reales`);
        res.json(chats);
      } else {
        console.log('WhatsApp no autenticado o no listo. No hay datos disponibles.');
        res.json([]);
      }
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
      
      // Verificar el estado de la conexión
      const status = whatsappService.getStatus();
      
      if (status.authenticated && status.ready) {
        // Obtener mensajes reales
        const messages = await whatsappService.getMessages(chatId, limit);
        console.log(`Obtenidos ${messages.length} mensajes reales para ${chatId}`);
        res.json(messages);
      } else {
        console.log(`WhatsApp no autenticado o no listo. No hay mensajes disponibles para ${chatId}`);
        res.json([]);
      }
    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
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
  app.get('/api/direct/whatsapp/qr-code', async (req: Request, res: Response) => {
    try {
      // Obtener el código QR más reciente
      const qrText = whatsappService.getLatestQR();
      
      if (!qrText) {
        return res.status(404).json({ error: 'No hay código QR disponible actualmente' });
      }
      
      // Generar imagen QR
      const qrDataUrl = await qrcode.toDataURL(qrText);
      
      // Devolver como JSON para evitar problemas con mimetype
      res.json({ qrDataUrl });
    } catch (error) {
      console.error('Error generando código QR:', error);
      res.status(500).json({ 
        error: 'Error generando código QR',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
  
  // Endpoint directo para obtener contactos de WhatsApp
  app.get('/api/direct/whatsapp/contacts', async (req: Request, res: Response) => {
    try {
      const contactType = req.query.type ? String(req.query.type) : 'all';
      const status = whatsappService.getStatus();
      
      if (!status.authenticated || !status.ready) {
        console.log('WhatsApp no autenticado o no listo. No hay contactos disponibles.');
        return res.json([]);
      }
      
      let contacts = [];
      
      switch (contactType) {
        case 'all':
          contacts = await getAllWhatsAppContacts();
          break;
        case 'groups':
          contacts = await getWhatsAppGroups();
          break;
        case 'category':
          const category = req.query.category ? String(req.query.category) : '';
          contacts = await getContactsByCategory(category);
          break;
        default:
          contacts = await getAllWhatsAppContacts();
      }
      
      res.json(contacts);
    } catch (error) {
      console.error('Error obteniendo contactos:', error);
      res.json([]);
    }
  });
  
  // Endpoint directo para buscar contactos
  app.get('/api/direct/whatsapp/contacts/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q ? String(req.query.q) : '';
      
      if (!query) {
        return res.status(400).json({ error: 'Se requiere un término de búsqueda (parámetro q)' });
      }
      
      const status = whatsappService.getStatus();
      
      if (!status.authenticated || !status.ready) {
        console.log('WhatsApp no autenticado o no listo. No hay contactos disponibles para buscar.');
        return res.json([]);
      }
      
      const results = await searchWhatsAppContacts(query);
      res.json(results);
    } catch (error) {
      console.error('Error buscando contactos:', error);
      res.json([]);
    }
  });
}