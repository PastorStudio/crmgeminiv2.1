import { Application, Request, Response, Router, NextFunction } from 'express';
import { Server } from 'http';
import { WebSocketServer } from 'ws';

/**
 * Configura todas las rutas de la API
 * @param app Aplicación Express
 * @param httpServer Servidor HTTP para WebSockets
 */
export function setupRoutes(app: Application, httpServer: Server) {
  // Rutas de API
  const apiRouter = Router();
  
  // Ruta de prueba
  apiRouter.get('/status', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });
  
  // Rutas para usuarios
  apiRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Implementar lógica para obtener usuarios
      const users = []; // Obtener de la base de datos
      res.json(users);
    } catch (error) {
      next(error);
    }
  });
  
  // Rutas para leads
  apiRouter.get('/leads', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Implementar lógica para obtener leads
      const leads = []; // Obtener de la base de datos
      res.json(leads);
    } catch (error) {
      next(error);
    }
  });
  
  // Rutas para WhatsApp
  const whatsappRouter = Router();
  
  whatsappRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ 
        initialized: true, 
        ready: true, 
        authenticated: true
      });
    } catch (error) {
      next(error);
    }
  });
  
  whatsappRouter.get('/qr', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Implementar lógica para obtener código QR
      res.json({ qrCode: 'data:image/png;base64,...' }); // Obtener código QR real
    } catch (error) {
      next(error);
    }
  });
  
  // Configuración API Keys
  apiRouter.get('/settings/openai-key-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hasKey = process.env.OPENAI_API_KEY ? true : false;
      res.json({ success: true, hasKey });
    } catch (error) {
      next(error);
    }
  });
  
  apiRouter.get('/settings/gemini-key-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar si hay clave de Gemini configurada
      const hasValidKey = process.env.GEMINI_API_KEY ? true : false;
      // Verificar si es clave temporal (cliente)
      const isTemporaryKey = process.env.GEMINI_API_KEY?.startsWith('AIza') && 
                            process.env.GEMINI_API_KEY?.length < 50;
                            
      res.json({ hasValidKey, isTemporaryKey });
    } catch (error) {
      next(error);
    }
  });
  
  // Configurar y montar los routers
  app.use('/api', apiRouter);
  app.use('/api/direct/whatsapp', whatsappRouter);
  
  // Ruta para verificar el estado de los servicios
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });
}