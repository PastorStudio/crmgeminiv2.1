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
  
  // Status endpoint - Endpoint especial para evitar intercepción de Vite
  app.get("/api/direct/whatsapp/status", async (req: Request, res: Response) => {
    try {
      // IMPORTANTE: Establecer cabeceras CORS y tipo de contenido explícitamente
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Cache-Control');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch(err => {
          console.error("Error inicializando servicio de WhatsApp:", err);
        });
      }
      
      const status = whatsappService.getStatus();
      
      // Log para depuración
      console.log("Enviando estado de WhatsApp (directo):", JSON.stringify(status));
      
      // Verificar que el objeto es serializable correctamente
      let safeStatus = { ...status };
      
      // Enviar respuesta como texto plano JSON para evitar procesamiento de Vite
      const jsonString = JSON.stringify(safeStatus);
      return res.send(jsonString);
    } catch (error) {
      console.error("Error obteniendo estado de WhatsApp:", error);
      
      // En caso de error, devolver un objeto de estado mínimo pero válido
      const errorResponse = { 
        message: "Error obteniendo estado de WhatsApp", 
        error: error instanceof Error ? error.message : "Error desconocido",
        initialized: true, 
        ready: false,
        authenticated: false
      };
      
      return res.status(500).send(JSON.stringify(errorResponse));
    }
  });

  // Status endpoint estándar (puede ser interceptado por Vite)
  app.get("/api/integrations/whatsapp/status", async (req: Request, res: Response) => {
    try {
      if (!whatsappService.getStatus().initialized) {
        await whatsappService.initialize().catch(err => {
          console.error("Error inicializando servicio de WhatsApp:", err);
        });
      }
      
      const status = whatsappService.getStatus();
      return res.status(200).json(status);
    } catch (error) {
      console.error("Error obteniendo estado de WhatsApp:", error);
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
        return res.status(200).json({ qrCode: status.qrCode });
      } else {
        return res.status(404).json({ message: "Código QR no disponible" });
      }
    } catch (error) {
      console.error("Error obteniendo código QR de WhatsApp:", error);
      return res.status(500).json({ 
        message: "Error obteniendo código QR de WhatsApp",
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });

  // QR Image endpoint (devuelve directamente la imagen) - Endpoint especial para evitar intercepción
  app.get("/api/direct/whatsapp/qr-image", async (req: Request, res: Response) => {
    try {
      // IMPORTANTE: Establecer cabeceras para prevenir caché e interceptación
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Cache-Control');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
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
            
            // Establecer tipo de contenido explícitamente
            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevenir que el navegador detecte otro tipo
            
            // Enviar la imagen como buffer binario para evitar que Vite la procese
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
          
          // Cabeceras adicionales para asegurar que se trata como imagen
          res.setHeader('Content-Type', contentType);
          res.setHeader('X-Content-Type-Options', 'nosniff');
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
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(canvas.toBuffer());
      }
    } catch (error) {
      console.error("Error obteniendo imagen QR de WhatsApp:", error);
      // En caso de error, generar una imagen de error
      const { createCanvas } = require('canvas');
      const canvas = createCanvas(300, 300);
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#fff0f0';
      ctx.fillRect(0, 0, 300, 300);
      
      ctx.font = '16px Arial';
      ctx.fillStyle = '#cc0000';
      ctx.textAlign = 'center';
      ctx.fillText('Error al generar código QR', 150, 150);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(500).send(canvas.toBuffer());
    }
  });

  // Restart endpoint - genera un nuevo código QR
  app.post("/api/integrations/whatsapp/restart", async (req: Request, res: Response) => {
    try {
      await whatsappService.restart();
      return res.status(200).json({ message: "Servicio de WhatsApp reiniciado correctamente" });
    } catch (error) {
      console.error("Error reiniciando servicio de WhatsApp:", error);
      return res.status(500).json({ 
        message: "Error reiniciando servicio de WhatsApp",
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });

  // Logout endpoint - cierra la sesión actual
  app.post("/api/integrations/whatsapp/logout", async (req: Request, res: Response) => {
    try {
      await whatsappService.logout();
      return res.status(200).json({ message: "Sesión de WhatsApp cerrada correctamente" });
    } catch (error) {
      console.error("Error cerrando sesión de WhatsApp:", error);
      return res.status(500).json({ 
        message: "Error cerrando sesión de WhatsApp",
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });

  // Send message endpoint
  app.post("/api/integrations/whatsapp/send", async (req: Request, res: Response) => {
    try {
      const { phone, message } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ message: "Se requiere número de teléfono y mensaje" });
      }
      
      // Validar formato de teléfono (simple)
      if (!/^\d+$/.test(phone)) {
        return res.status(400).json({ message: "Formato de teléfono inválido, solo use números" });
      }
      
      const result = await whatsappService.sendMessage(phone, message);
      return res.status(200).json({ 
        message: "Mensaje enviado correctamente",
        result
      });
    } catch (error) {
      console.error("Error enviando mensaje de WhatsApp:", error);
      return res.status(500).json({ 
        message: "Error enviando mensaje de WhatsApp",
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });

  // Registrar con éxito
  console.log("Rutas de WhatsApp registradas");
}
