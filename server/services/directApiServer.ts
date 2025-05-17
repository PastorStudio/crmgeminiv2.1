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
      // Verificar el estado de la conexión primero
      const status = whatsappService.getStatus();
      console.log('Estado actual de WhatsApp:', status);
      
      // Si no está autenticado, intentar reconectar
      if (!status.authenticated || !status.ready) {
        console.log('Estado de WhatsApp no es óptimo para obtener chats, intentando verificar conexión...');
        try {
          // Intentar verificar y restaurar la conexión
          await whatsappService.checkConnection();
          // Esperar un momento para que se estabilice
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (connError) {
          console.warn('Error verificando conexión en endpoint de chats:', connError);
          // Continuar de todos modos, tal vez tengamos chats en caché
        }
      }
      
      console.log('Forzando actualización de chats...');
      
      // Para depuración y compatibilidad, vamos a devolver los chats directamente como un array
      // Esto mantendrá compatibilidad con clientes que esperan un array directamente
      const chats = await whatsappService.getChats();
      console.log(`Número de chats obtenidos: ${chats.length}`);
      
      // Devolver solo el array de chats, para mantener compatibilidad
      res.json(chats);
    } catch (error) {
      console.error('Error obteniendo chats:', error);
      // Devolver un array vacío para mantener compatibilidad
      res.json([]);
    }
  });
  
  // Endpoint directo para obtener mensajes de un chat específico
  app.get('/api/direct/whatsapp/messages/:chatId', async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000; // Aumentado para mostrar más mensajes
      
      if (!chatId) {
        return res.status(400).json({ error: 'Se requiere el ID del chat' });
      }
      
      // Verificar el estado de la conexión primero
      const status = whatsappService.getStatus();
      console.log('Estado actual de WhatsApp para mensajes:', status);
      
      // Si no está autenticado, intentar reconectar
      if (!status.authenticated || !status.ready) {
        console.log('Estado de WhatsApp no es óptimo para obtener mensajes, intentando verificar conexión...');
        try {
          // Intentar verificar y restaurar la conexión
          await whatsappService.checkConnection();
          // Esperar un momento para que se estabilice
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (connError) {
          console.warn('Error verificando conexión en endpoint de mensajes:', connError);
          // Continuar de todos modos, tal vez tengamos mensajes en caché
        }
      }
      
      // Intentamos cargar los mensajes con un límite alto
      const effectiveLimit = Math.max(limit, 1000); // Al menos 1000 mensajes
      console.log(`Solicitando ${effectiveLimit} mensajes para el chat ${chatId}`);
      
      const messages = await whatsappService.getMessages(chatId, effectiveLimit);
      console.log(`Recuperados ${messages.length} mensajes para el chat ${chatId}`);
      
      // Para mantener compatibilidad, devolvemos directamente el array de mensajes
      res.json(messages);
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