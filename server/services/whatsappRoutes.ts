/**
 * Rutas para la integración de WhatsApp
 * Estas rutas manejan la generación de códigos QR, envío de mensajes y estado de la conexión
 */

import { Express, Request, Response } from 'express';
// Importamos el servicio de demostración por defecto
import { whatsappDemoService } from './whatsappDemoService';
// Interfaz común para WhatsApp
import { IWhatsAppService } from './whatsappInterface';

export async function registerWhatsAppRoutes(app: Express) {
  // Definir servicio a utilizar
  let whatsappService: IWhatsAppService = whatsappDemoService;
  
  // Status endpoint
  app.get("/api/integrations/whatsapp/status", async (req: Request, res: Response) => {
    try {
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch(err => {
          console.error("Error inicializando servicio de WhatsApp:", err);
        });
      }
      
      const status = whatsappService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error obteniendo estado de WhatsApp:", error);
      res.status(500).json({ 
        message: "Error obteniendo estado de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // QR Code endpoint
  app.get("/api/integrations/whatsapp/qrcode", async (req: Request, res: Response) => {
    try {
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch(err => {
          console.error("Error inicializando servicio de WhatsApp:", err);
        });
      }
      
      const status = whatsappService.getStatus();
      
      if (status.qrCode) {
        res.json({ data: status.qrCode });
      } else {
        res.status(204).json({ message: "No hay código QR disponible" });
      }
    } catch (error) {
      console.error("Error obteniendo código QR de WhatsApp:", error);
      res.status(500).json({ 
        message: "Error obteniendo código QR de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Restart endpoint - genera un nuevo código QR
  app.post("/api/integrations/whatsapp/restart", async (req: Request, res: Response) => {
    try {
      console.log("Reiniciando servicio de WhatsApp...");
      await whatsappService.restart();
      res.json({ success: true });
    } catch (error) {
      console.error("Error reiniciando servicio de WhatsApp:", error);
      res.status(500).json({ 
        message: "Error reiniciando servicio de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Logout endpoint
  app.post("/api/integrations/whatsapp/logout", async (req: Request, res: Response) => {
    try {
      console.log("Cerrando sesión de WhatsApp...");
      const result = await whatsappService.logout();
      res.json(result);
    } catch (error) {
      console.error("Error cerrando sesión de WhatsApp:", error);
      res.status(500).json({ 
        message: "Error cerrando sesión de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Send message endpoint
  app.post("/api/integrations/whatsapp/send", async (req: Request, res: Response) => {
    try {
      const { to, message, leadId } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ message: "Se requieren los parámetros 'to' y 'message'" });
      }
      
      console.log(`Enviando mensaje a ${to}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
      
      const result = await whatsappService.sendMessage(to, message, leadId);
      res.json({ success: true, result });
    } catch (error) {
      console.error("Error enviando mensaje de WhatsApp:", error);
      res.status(500).json({ 
        message: "Error enviando mensaje de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });
  
  console.log("Rutas de WhatsApp registradas");
}