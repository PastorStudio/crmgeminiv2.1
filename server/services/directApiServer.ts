/**
 * Servidor de API directa para integración de mensajería en tiempo real
 */

import { Request, Response } from 'express';
import whatsappService from './whatsappService';
import fs from 'fs';
import path from 'path';

// Ruta del archivo QR
const QR_TEXT_FILE = path.join(process.cwd(), 'temp', 'whatsapp-qr.txt');

export const registerDirectAPIRoutes = (app: any) => {
  
  // Obtener estado de WhatsApp
  app.get("/api/direct/whatsapp/status", async (req: Request, res: Response) => {
    try {
      const status = await whatsappService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error obteniendo estado de WhatsApp:', error);
      res.status(500).json({ error: 'Error obteniendo estado de WhatsApp' });
    }
  });
  
  // Obtener código QR de WhatsApp como imagen
  app.get("/api/direct/whatsapp/qrcode", async (req: Request, res: Response) => {
    try {
      // Verificar si existe el archivo QR
      if (fs.existsSync(QR_TEXT_FILE)) {
        // Leer contenido del QR
        const qrText = fs.readFileSync(QR_TEXT_FILE, 'utf8');
        
        // Importar qrcode
        const qrcode = await import('qrcode');
        
        // Convertir a buffer de imagen
        const qrBuffer = await qrcode.toBuffer(qrText);
        
        // Devolver como base64
        res.json({
          success: true,
          qrcode: qrBuffer.toString('base64')
        });
      } else {
        res.status(404).json({ 
          success: false, 
          error: 'Código QR no disponible' 
        });
      }
    } catch (error) {
      console.error('Error obteniendo código QR:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al procesar código QR' 
      });
    }
  });
  
  // Obtener el texto del código QR directamente
  app.get("/api/direct/whatsapp/qr-text", async (req: Request, res: Response) => {
    try {
      // Verificar si existe el archivo QR
      if (fs.existsSync(QR_TEXT_FILE)) {
        // Leer contenido del QR
        const qrText = fs.readFileSync(QR_TEXT_FILE, 'utf8');
        
        // Devolver el texto del QR
        res.json({
          success: true,
          qrText: qrText
        });
      } else {
        res.status(404).json({ 
          success: false, 
          error: 'Código QR no disponible' 
        });
      }
    } catch (error) {
      console.error('Error obteniendo texto del código QR:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al procesar código QR' 
      });
    }
  });
  
  // Obtener chats de WhatsApp
  app.get("/api/direct/whatsapp/chats", async (req: Request, res: Response) => {
    try {
      // Obtener estado actual
      const status = await whatsappService.getStatus();
      
      // Para depuración - ver el estado real de la conexión
      console.log('Obteniendo lista de chats...');
      console.log('Actualizando lista de chats - cliente está autenticado:', status.authenticated);
      
      // Verificar si está autenticado
      if (!status.authenticated) {
        console.log('WhatsApp no autenticado o no listo. No hay datos disponibles.');
        // Generar datos de muestra temporales para desarrollo
        const demoChats = [
          {
            id: "123456789@c.us",
            name: "Cliente Importante",
            timestamp: Math.floor(Date.now() / 1000) - 300,
            lastMessage: "¿Cuándo podemos agendar la reunión?",
            unreadCount: 2,
            isGroup: false
          },
          {
            id: "987654321@c.us",
            name: "Soporte Técnico",
            timestamp: Math.floor(Date.now() / 1000) - 1800,
            lastMessage: "El problema ha sido resuelto.",
            unreadCount: 0,
            isGroup: false
          },
          {
            id: "11111111@g.us",
            name: "Equipo de Ventas",
            timestamp: Math.floor(Date.now() / 1000) - 7200,
            lastMessage: "Revisemos los resultados mañana.",
            unreadCount: 5,
            isGroup: true
          }
        ];
        return res.json(demoChats);
      }
      
      try {
        // Importar e instanciar servicio específico de WhatsApp
        const { whatsappService: whatsappImpl } = await import('./whatsappServiceImpl');
        
        // Intentar obtener chats reales - con reintentos automáticos
        let attempt = 1;
        let chats = [];
        const maxAttempts = 3;
        
        while (attempt <= maxAttempts) {
          console.log(`Intento ${attempt} de obtener chats reales...`);
          try {
            chats = await whatsappImpl.getChats();
            console.log(`Obtenidos ${chats.length} chats en intento ${attempt}`);
            
            if (chats && chats.length > 0) {
              console.log('Procesando', chats.length, 'chats...');
              break; // Salir del bucle si tenemos chats
            }
          } catch (attemptError) {
            console.error(`Error en intento ${attempt}:`, attemptError);
          }
          
          attempt++;
          if (attempt <= maxAttempts) {
            // Esperar un poco antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Devolver los chats obtenidos
        return res.json(chats);
      } catch (serviceError) {
        console.error('Error importando servicio de WhatsApp:', serviceError);
        return res.status(500).json({ error: 'Error en el servicio de WhatsApp' });
      }
    } catch (error) {
      console.error('Error obteniendo chats de WhatsApp:', error);
      res.status(500).json({ error: 'Error obteniendo chats de WhatsApp' });
    }
  });
  
  // Obtener mensajes de un chat específico
  app.get("/api/direct/whatsapp/messages/:chatId", async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      
      // Obtener estado actual
      const status = await whatsappService.getStatus();
      
      // Verificar si está autenticado
      if (!status.authenticated) {
        console.log(`WhatsApp no autenticado o no listo. No hay mensajes disponibles para ${chatId}`);
        return res.json([]);
      }
      
      // Importar e instanciar servicio específico de WhatsApp
      const { whatsappService: whatsappImpl } = await import('./whatsappServiceImpl');
      
      // Obtener mensajes reales
      const messages = await whatsappImpl.getMessages(chatId);
      
      // Devolver los mensajes
      return res.json(messages);
    } catch (error) {
      console.error(`Error obteniendo mensajes para ${req.params.chatId}:`, error);
      res.status(500).json({ error: 'Error obteniendo mensajes' });
    }
  });
  
  // Enviar mensaje a un chat
  app.post("/api/direct/whatsapp/send", async (req: Request, res: Response) => {
    try {
      const { chatId, message } = req.body;
      
      if (!chatId || !message) {
        return res.status(400).json({ error: 'Se requiere chatId y message' });
      }
      
      // Obtener estado actual
      const status = await whatsappService.getStatus();
      
      // Verificar si está autenticado
      if (!status.authenticated) {
        return res.status(403).json({ error: 'WhatsApp no está autenticado' });
      }
      
      // Enviar mensaje
      const result = await whatsappService.sendMessage(chatId, message);
      
      // Devolver resultado
      return res.json({
        success: true,
        messageId: result?.id || null
      });
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      res.status(500).json({ error: 'Error al enviar mensaje' });
    }
  });
  
  // Cerrar sesión de WhatsApp
  app.post("/api/direct/whatsapp/logout", async (req: Request, res: Response) => {
    try {
      // Importar e instanciar servicio específico de WhatsApp
      const { whatsappService: whatsappImpl } = await import('./whatsappServiceImpl');
      
      // Cerrar sesión
      await whatsappImpl.logout();
      
      // Devolver resultado
      return res.json({
        success: true,
        message: 'Sesión cerrada correctamente'
      });
    } catch (error) {
      console.error('Error cerrando sesión:', error);
      res.status(500).json({ error: 'Error al cerrar sesión' });
    }
  });
};