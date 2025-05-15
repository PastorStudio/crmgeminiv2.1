/**
 * Servicio que crea endpoints directos para evitar la interceptación de Vite
 * Esta es una solución para el problema donde Vite intercepta las llamadas API
 * y devuelve HTML en lugar de JSON.
 */

import { Express, Request, Response } from 'express';
import { whatsappService } from './whatsappServiceImpl';
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

  console.log('Rutas API directas registradas para evitar interceptación de Vite');
}