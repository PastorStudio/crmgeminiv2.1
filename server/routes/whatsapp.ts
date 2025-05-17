import express, { Request, Response } from 'express';
import { whatsappService } from '../services/whatsappServiceImpl';

// Crear un router de Express para las rutas de WhatsApp
const router = express.Router();

// Ruta para verificar el estado de WhatsApp
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = whatsappService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error obteniendo estado de WhatsApp:', error);
    res.status(500).json({ error: 'Error obteniendo estado' });
  }
});

// Ruta para verificación profunda de autenticación
router.post('/check-auth-deep', async (req: Request, res: Response) => {
  try {
    const authStatus = await whatsappService.checkAuthenticationDirect();
    console.log('Verificación profunda de autenticación:', authStatus);
    
    if (authStatus.authenticated) {
      // Forzar actualización de estado si realmente está autenticado
      await whatsappService.fixAuthenticationState();
      
      res.json({
        success: true,
        message: 'Verificación exitosa, autenticación confirmada',
        authDetails: authStatus,
        updatedStatus: whatsappService.getStatus()
      });
    } else {
      res.json({
        success: false,
        message: 'No está autenticado según verificación profunda',
        authDetails: authStatus,
        status: whatsappService.getStatus()
      });
    }
  } catch (error) {
    console.error('Error en verificación profunda:', error);
    res.status(500).json({
      success: false,
      error: 'Error realizando verificación',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Ruta para corregir el estado de autenticación
router.post('/fix-auth-state', async (req: Request, res: Response) => {
  try {
    const result = await whatsappService.fixAuthenticationState();
    
    if (result) {
      res.json({
        success: true,
        message: 'Estado de autenticación corregido exitosamente',
        status: whatsappService.getStatus()
      });
    } else {
      res.json({
        success: false,
        message: 'No se pudo corregir el estado de autenticación',
        status: whatsappService.getStatus()
      });
    }
  } catch (error) {
    console.error('Error corrigiendo estado de autenticación:', error);
    res.status(500).json({
      success: false,
      error: 'Error corrigiendo estado',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Exportar el router para usar en el archivo principal de rutas
export default router;