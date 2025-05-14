/**
 * Rutas dedicadas para la integración de WhatsApp que generan un código QR real
 */
import type { Express, Request, Response } from "express";

// Importar el servicio simplificado
import { whatsappService } from './whatsappServiceImpl';

export function registerWhatsAppRoutes(app: Express): void {
  // Status endpoint
  app.get("/api/integrations/whatsapp/status", async (req: Request, res: Response) => {
    try {
      // Inicializar si no está inicializado
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch((err: any) => {
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
      // Inicializar si no está inicializado
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch((err: any) => {
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
        return res.status(400).json({ message: "Se requiere número de teléfono y mensaje" });
      }
      
      console.log(`Enviando mensaje a ${to}: ${message} (leadId: ${leadId || 'N/A'})`);
      const result = await whatsappService.sendMessage(
        to, 
        message, 
        leadId ? parseInt(leadId) : undefined
      );
      
      res.json({
        success: true,
        message: "Mensaje enviado correctamente",
        result
      });
    } catch (error) {
      console.error("Error enviando mensaje de WhatsApp:", error);
      res.status(500).json({ 
        message: "Error enviando mensaje de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
}