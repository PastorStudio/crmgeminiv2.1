/**
 * Implementación de rutas de API directas que no pasan por Vite
 */

import type { Express } from "express";
import whatsappService from './simplified-whatsappService';
import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

export function registerDirectAPIRoutes(app: Express): void {
  // Rutas directas para obtener el estado de WhatsApp (incluido el código QR)
  app.get('/api/direct/whatsapp/status', async (req, res) => {
    try {
      const status = whatsappService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error al obtener estado de WhatsApp:', error);
      res.status(500).json({
        error: 'Error interno',
        message: 'Error al obtener el estado de WhatsApp'
      });
    }
  });

  // Ruta para obtener específicamente el código QR
  app.get('/api/direct/whatsapp/qr', async (req, res) => {
    try {
      const status = whatsappService.getStatus();
      if (status.qrCode) {
        res.json({ qrCode: status.qrCode });
      } else {
        res.status(404).json({
          error: 'QR no disponible',
          message: 'No hay código QR disponible actualmente'
        });
      }
    } catch (error) {
      console.error('Error al obtener código QR:', error);
      res.status(500).json({
        error: 'Error interno',
        message: 'Error al obtener el código QR'
      });
    }
  });

  // Ruta para inicializar el servicio de WhatsApp
  app.post('/api/direct/whatsapp/initialize', async (req, res) => {
    try {
      await whatsappService.initialize();
      const status = whatsappService.getStatus();
      res.json({ 
        message: 'Servicio inicializado correctamente',
        status
      });
    } catch (error) {
      console.error('Error al inicializar servicio de WhatsApp:', error);
      res.status(500).json({
        error: 'Error interno',
        message: 'Error al inicializar el servicio de WhatsApp'
      });
    }
  });

  // Ruta para mostrar el código QR como imagen
  app.get('/api/direct/whatsapp/qr-image', async (req, res) => {
    try {
      const status = whatsappService.getStatus();
      if (status.qrCode) {
        // Redirige al servicio de API de QR
        res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(status.qrCode)}`);
      } else {
        res.status(404).send('No hay código QR disponible actualmente');
      }
    } catch (error) {
      console.error('Error al generar imagen de QR:', error);
      res.status(500).send('Error interno al generar la imagen del código QR');
    }
  });

  // Endpoint para obtener chats
  app.get('/api/direct/whatsapp/chats', async (req, res) => {
    try {
      console.log('🔄 Obteniendo chats desde WhatsApp...');
      
      // Verificar si hay clientes conectados
      const connectedAccounts = whatsappMultiAccountManager.getConnectedAccounts();
      if (connectedAccounts.length === 0) {
        console.log('📭 No hay cuentas WhatsApp conectadas');
        res.json([]);
        return;
      }
      
      // Obtener chats de la primera cuenta conectada
      const accountId = connectedAccounts[0];
      const chats = await whatsappMultiAccountManager.getChats(accountId);
      
      console.log(`✅ Obtenidos ${chats.length} chats para cuenta ${accountId}`);
      res.json(chats);
    } catch (error) {
      console.error('❌ Error obteniendo chats:', error);
      res.json([]); // Devolver array vacío en lugar de error
    }
  });

  // Endpoint para obtener mensajes de un chat
  app.get('/api/direct/whatsapp/messages/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      console.log(`🔄 Obteniendo mensajes para chat ${chatId}...`);
      
      // Verificar si hay clientes conectados
      const connectedAccounts = whatsappMultiAccountManager.getConnectedAccounts();
      if (connectedAccounts.length === 0) {
        console.log('📭 No hay cuentas WhatsApp conectadas');
        res.json([]);
        return;
      }
      
      // Obtener mensajes de la primera cuenta conectada
      const accountId = connectedAccounts[0];
      const messages = await whatsappMultiAccountManager.getMessages(accountId, chatId, limit);
      
      console.log(`✅ Obtenidos ${messages.length} mensajes para chat ${chatId}`);
      res.json(messages);
    } catch (error) {
      console.error(`❌ Error obteniendo mensajes para chat ${chatId}:`, error);
      res.json([]); // Devolver array vacío en lugar de error
    }
  });

  // Endpoint para enviar mensajes
  app.post('/api/direct/whatsapp/send-message', async (req, res) => {
    try {
      const { chatId, message, accountId } = req.body;
      
      console.log(`📤 Enviando mensaje a chat ${chatId}...`);
      
      // Usar el accountId especificado o el primero conectado
      const targetAccountId = accountId || whatsappMultiAccountManager.getConnectedAccounts()[0];
      
      if (!targetAccountId) {
        throw new Error('No hay cuentas WhatsApp conectadas');
      }
      
      const result = await whatsappMultiAccountManager.sendMessage(targetAccountId, chatId, message);
      
      console.log(`✅ Mensaje enviado exitosamente`);
      res.json({ success: true, result });
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      res.status(500).json({ error: 'Error al enviar mensaje' });
    }
  });

  console.log('Rutas de API directa registradas correctamente');
}