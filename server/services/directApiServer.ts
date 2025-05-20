/**
 * Implementación de rutas de API directas que no pasan por Vite
 */

import type { Express } from "express";
import whatsappService from './simplified-whatsappService';

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

  console.log('Rutas de API directa registradas correctamente');
}