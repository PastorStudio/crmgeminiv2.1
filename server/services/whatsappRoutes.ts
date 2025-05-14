/**
 * Rutas dedicadas para la integración de WhatsApp que generan un código QR real
 */
import { Express, Request, Response } from "express";
import { whatsappDirectService } from "./whatsappDirectService";

export function registerWhatsAppRoutes(app: Express): void {
  // Status endpoint
  app.get("/api/integrations/whatsapp/status", async (req: Request, res: Response) => {
    try {
      // Inicializar si no está inicializado
      if (!whatsappDirectService.getStatus().initialized) {
        await whatsappDirectService.initialize().catch(err => {
          console.error("Error inicializando servicio directo de WhatsApp:", err);
        });
      }
      const status = whatsappDirectService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error obteniendo estado de WhatsApp:", error);
      res.status(500).json({ 
        message: "Error obteniendo estado de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Restart endpoint - genera un nuevo código QR
  app.post("/api/integrations/whatsapp/restart", async (req: Request, res: Response) => {
    try {
      console.log("Reiniciando servicio de WhatsApp (modo directo)...");
      const result = await whatsappDirectService.restart();
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
      const result = await whatsappDirectService.logout();
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
      const result = await whatsappDirectService.sendMessage(
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