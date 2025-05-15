/**
 * Rutas para la integración de WhatsApp
 * Estas rutas manejan la generación de códigos QR, envío de mensajes y estado de la conexión
 */

import { Express, Request, Response } from 'express';
// Importamos el servicio real de WhatsApp
import { whatsappService } from './whatsappServiceImpl';
// Servicio de demostración como fallback
import { whatsappDemoService } from './whatsappDemoService';
// Interfaz común para WhatsApp
import { IWhatsAppService } from './whatsappInterface';

export async function registerWhatsAppRoutes(app: Express) {
  // Intentamos usar el servicio real con whatsapp-web.js
  let serviceToUse: IWhatsAppService;
  
  try {
    // Importamos dinámicamente el servicio real
    const { whatsappService: realService } = await import('./whatsappServiceImpl');
    serviceToUse = realService;
    console.log("Usando servicio REAL de WhatsApp con códigos QR oficiales de WhatsApp Web");
    
    // Inicializamos el servicio
    try {
      await serviceToUse.initialize();
    } catch (error) {
      console.error("Error inicializando servicio real de WhatsApp:", error);
      console.log("Cambiando a servicio de demostración debido a error de inicialización");
      serviceToUse = whatsappDemoService;
      await serviceToUse.initialize();
    }
  } catch (error) {
    console.error("Error cargando servicio real de WhatsApp:", error);
    console.log("Usando servicio demo de WhatsApp con códigos QR en formato whatsapp://");
    serviceToUse = whatsappDemoService;
    await serviceToUse.initialize();
  }
  
  // Asignamos el servicio elegido
  const whatsappService = serviceToUse;
  
  // Status endpoint
  app.get("/api/integrations/whatsapp/status", async (req: Request, res: Response) => {
    try {
      // IMPORTANTE: Establecer cabeceras CORS y tipo de contenido
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
      res.header('Content-Type', 'application/json');
      
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch(err => {
          console.error("Error inicializando servicio de WhatsApp:", err);
        });
      }
      
      const status = whatsappService.getStatus();
      
      // Log para depuración
      console.log("Enviando estado de WhatsApp:", JSON.stringify(status));
      
      // Verificar que el objeto es serializable correctamente
      let safeStatus = { ...status };
      
      // Asegurarse de que el response no sea interceptado o transformado
      return res.status(200).json(safeStatus);
    } catch (error) {
      console.error("Error obteniendo estado de WhatsApp:", error);
      
      // En caso de error, devolver un objeto de estado mínimo pero válido
      return res.status(500).json({ 
        message: "Error obteniendo estado de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido",
        initialized: true, 
        ready: false,
        authenticated: false
      });
    }
  });

  // QR Code endpoint para JSON
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

  // QR Image endpoint (devuelve directamente la imagen)
  app.get("/api/integrations/whatsapp/qr-image", async (req: Request, res: Response) => {
    try {
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch(err => {
          console.error("Error inicializando servicio de WhatsApp:", err);
        });
      }
      
      const status = whatsappService.getStatus();
      
      if (status.qrCode) {
        console.log("Sirviendo código QR, tipo:", typeof status.qrCode);
        
        // Extraer el tipo de contenido y los datos base64
        if (status.qrCode.startsWith('data:')) {
          const parts = status.qrCode.split(',');
          const contentType = parts[0].split(':')[1].split(';')[0];
          const base64Data = parts[1];
          
          // Log para depuración
          console.log(`Tipo de contenido detectado: ${contentType}, tamaño de datos: ${base64Data.length}`);
          
          try {
            const imgBuffer = Buffer.from(base64Data, 'base64');
            
            // Prevenir que Vite intercepte la respuesta
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
            res.setHeader('Content-Type', contentType);
            
            return res.send(imgBuffer);
          } catch (err) {
            console.error("Error decodificando base64:", err);
            return res.status(500).send("Error procesando imagen");
          }
        } else {
          // Si no es data URL, crear una imagen QR desde el texto
          const qrcode = require('qrcode');
          const qrDataURL = await qrcode.toDataURL(status.qrCode, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 8,
            color: {
              dark: '#128C7E',  // Color verde WhatsApp
              light: '#FFFFFF'  // Fondo blanco
            }
          });
          
          const parts = qrDataURL.split(',');
          const contentType = parts[0].split(':')[1].split(';')[0];
          const base64Data = parts[1];
          
          const imgBuffer = Buffer.from(base64Data, 'base64');
          
          res.setHeader('Content-Type', contentType);
          return res.send(imgBuffer);
        }
      } else {
        // Generar una imagen de "No hay QR disponible"
        const { createCanvas } = require('canvas');
        const canvas = createCanvas(300, 300);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, 300, 300);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No hay código QR disponible', 150, 150);
        
        res.setHeader('Content-Type', 'image/png');
        return res.send(canvas.toBuffer());
      }
    } catch (error) {
      console.error("Error obteniendo imagen QR de WhatsApp:", error);
      res.status(500).send("Error obteniendo imagen QR");
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