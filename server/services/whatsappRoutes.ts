/**
 * Rutas para la integración de WhatsApp
 * Estas rutas manejan la generación de códigos QR, envío de mensajes y estado de la conexión
 */

import { Express, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as qrcode from 'qrcode';
import { whatsappService } from './whatsappServiceImpl';
import { getAllWhatsAppContacts, getContactsByCategory, searchWhatsAppContacts, getWhatsAppGroups } from './whatsappContactsService';
import { Server } from 'http';

// Ruta del archivo temporal para el QR
const QR_TEXT_FILE = path.join(process.cwd(), 'temp', 'whatsapp-qr.txt');
const QR_IMAGE_FILE = path.join(process.cwd(), 'temp', 'whatsapp-qr.png');

export async function registerWhatsAppRoutes(app: Express): Promise<void> {
  try {
    // Inicializamos el servicio
    await whatsappService.initialize().catch(err => {
      console.error("Error inicializando servicio de WhatsApp:", err);
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
        
        // Si tenemos un código QR en texto pero no en dataURL, generamos la dataURL
        if (status.qrCode && !status.qrDataUrl) {
          try {
            const qrDataUrl = await qrcode.toDataURL(status.qrCode, {
              errorCorrectionLevel: 'H',
              type: 'image/png',
              margin: 4,
              scale: 4,
              color: {
                dark: '#128C7E',  // Color principal de WhatsApp
                light: '#FFFFFF'
              }
            });
            
            // Actualizamos el status con la dataURL
            status.qrDataUrl = qrDataUrl;
          } catch (error) {
            console.error("Error generando dataURL del QR:", error);
          }
        }
        
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
          // Si tenemos un dataURL generado, lo devolvemos directamente
          if (status.qrDataUrl) {
            return res.status(200).json({ qrCode: status.qrDataUrl });
          }
          
          // Si no tenemos dataURL, pero tenemos el código QR, generamos el dataURL
          try {
            const qrDataUrl = await qrcode.toDataURL(status.qrCode, {
              errorCorrectionLevel: 'H',
              type: 'image/png',
              margin: 4,
              scale: 4,
              color: {
                dark: '#128C7E',  // Color principal de WhatsApp
                light: '#FFFFFF'
              }
            });
            
            return res.status(200).json({ qrCode: qrDataUrl });
          } catch (error) {
            console.error("Error generando dataURL del QR:", error);
            return res.status(500).json({ 
              message: "Error generando dataURL del QR",
              error: error instanceof Error ? error.message : "Error desconocido"
            });
          }
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

    // QR Image endpoint (devuelve directamente la imagen)
    app.get("/api/integrations/whatsapp/qr-image", async (req: Request, res: Response) => {
      try {
        // IMPORTANTE: Establecer cabeceras para prevenir caché e interceptación
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const status = whatsappService.getStatus();
        
        // Si tenemos un código QR
        if (status.qrCode) {
          // Si tenemos un dataURL, lo convertimos a buffer y enviamos
          if (status.qrDataUrl) {
            const dataUrl = status.qrDataUrl;
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            return res.send(imageBuffer);
          }
          
          // Si no tenemos dataURL pero tenemos el texto del QR, generamos la imagen
          try {
            // Generamos la imagen en un buffer
            const pngBuffer = await qrcode.toBuffer(status.qrCode, {
              errorCorrectionLevel: 'H',
              type: 'png',
              margin: 4,
              scale: 4,
              color: {
                dark: '#128C7E',  // Color principal de WhatsApp
                light: '#FFFFFF'
              }
            });
            
            return res.send(pngBuffer);
          } catch (error) {
            console.error("Error generando imagen QR:", error);
            // En caso de error, enviamos una imagen de error
            return res.status(500).sendFile(path.join(process.cwd(), 'public', 'qr-error.png'));
          }
        } else if (fs.existsSync(QR_TEXT_FILE)) {
          // Si no tenemos QR en el servicio pero existe el archivo
          try {
            const qrText = fs.readFileSync(QR_TEXT_FILE, 'utf-8');
            
            // Generamos la imagen en un buffer
            const pngBuffer = await qrcode.toBuffer(qrText, {
              errorCorrectionLevel: 'H',
              type: 'png',
              margin: 4,
              scale: 4,
              color: {
                dark: '#128C7E',  // Color principal de WhatsApp
                light: '#FFFFFF'
              }
            });
            
            return res.send(pngBuffer);
          } catch (error) {
            console.error("Error generando imagen QR desde archivo:", error);
            return res.status(500).sendFile(path.join(process.cwd(), 'public', 'qr-error.png'));
          }
        } else {
          // No hay código QR disponible
          return res.status(404).sendFile(path.join(process.cwd(), 'public', 'qr-unavailable.png'));
        }
      } catch (error) {
        console.error("Error sirviendo imagen QR:", error);
        return res.status(500).send("Error generando imagen QR");
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
    
    // Get all contacts endpoint
    app.get("/api/integrations/whatsapp/contacts", async (req: Request, res: Response) => {
      try {
        const contacts = await getAllWhatsAppContacts();
        return res.status(200).json(contacts);
      } catch (error) {
        console.error("Error obteniendo contactos de WhatsApp:", error);
        return res.status(500).json({ 
          message: "Error obteniendo contactos de WhatsApp",
          error: error instanceof Error ? error.message : "Error desconocido"
        });
      }
    });
    
    // Get contacts by category endpoint
    app.get("/api/integrations/whatsapp/contacts/categories", async (req: Request, res: Response) => {
      try {
        const categorizedContacts = await getContactsByCategory();
        return res.status(200).json(categorizedContacts);
      } catch (error) {
        console.error("Error obteniendo contactos categorizados de WhatsApp:", error);
        return res.status(500).json({ 
          message: "Error obteniendo contactos categorizados de WhatsApp",
          error: error instanceof Error ? error.message : "Error desconocido"
        });
      }
    });
    
    // Search contacts endpoint
    app.get("/api/integrations/whatsapp/contacts/search", async (req: Request, res: Response) => {
      try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
          return res.status(400).json({ message: "Se requiere término de búsqueda" });
        }
        
        const searchResults = await searchWhatsAppContacts(query);
        return res.status(200).json(searchResults);
      } catch (error) {
        console.error("Error buscando contactos de WhatsApp:", error);
        return res.status(500).json({ 
          message: "Error buscando contactos de WhatsApp",
          error: error instanceof Error ? error.message : "Error desconocido"
        });
      }
    });
    
    // Get groups endpoint
    app.get("/api/integrations/whatsapp/groups", async (req: Request, res: Response) => {
      try {
        const groups = await getWhatsAppGroups();
        return res.status(200).json(groups);
      } catch (error) {
        console.error("Error obteniendo grupos de WhatsApp:", error);
        return res.status(500).json({ 
          message: "Error obteniendo grupos de WhatsApp",
          error: error instanceof Error ? error.message : "Error desconocido"
        });
      }
    });

    console.log("Rutas de WhatsApp registradas");
  } catch (error) {
    console.error("Error registrando rutas de WhatsApp:", error);
  }
}