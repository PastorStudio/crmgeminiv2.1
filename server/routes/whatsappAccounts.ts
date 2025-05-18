import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { insertWhatsappAccountSchema } from '@shared/schema';
import whatsappService from '../services/whatsappService';
import fs from 'fs';
import path from 'path';

const router = Router();

// Obtener todas las cuentas de WhatsApp
router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await storage.getAllWhatsappAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Error al obtener cuentas de WhatsApp:', error);
    res.status(500).json({ error: 'Error al obtener cuentas de WhatsApp' });
  }
});

// Obtener una cuenta específica de WhatsApp
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const account = await storage.getWhatsappAccount(parseInt(id));
    
    if (!account) {
      return res.status(404).json({ error: 'Cuenta de WhatsApp no encontrada' });
    }
    
    res.json(account);
  } catch (error) {
    console.error('Error al obtener cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al obtener cuenta de WhatsApp' });
  }
});

// Crear una nueva cuenta de WhatsApp
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validar los datos de entrada con el esquema
    const validation = insertWhatsappAccountSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: 'Datos de entrada inválidos', details: validation.error });
    }
    
    // Si hay un usuario autenticado, asignarlo como administrador
    if (req.user && req.user.id) {
      req.body.adminId = req.user.id;
    }
    
    // Crear la cuenta
    const newAccount = await storage.createWhatsappAccount(req.body);
    
    res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error al crear cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al crear cuenta de WhatsApp' });
  }
});

// Actualizar una cuenta de WhatsApp
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const accountId = parseInt(id);
    
    // Verificar si la cuenta existe
    const existingAccount = await storage.getWhatsappAccount(accountId);
    
    if (!existingAccount) {
      return res.status(404).json({ error: 'Cuenta de WhatsApp no encontrada' });
    }
    
    // Actualizar la cuenta
    const updatedAccount = await storage.updateWhatsappAccount(accountId, req.body);
    
    res.json(updatedAccount);
  } catch (error) {
    console.error('Error al actualizar cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al actualizar cuenta de WhatsApp' });
  }
});

// Actualizar estado de una cuenta
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const accountId = parseInt(id);
    
    if (!status || !['active', 'inactive', 'pending_auth'].includes(status)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    
    // Verificar si la cuenta existe
    const existingAccount = await storage.getWhatsappAccount(accountId);
    
    if (!existingAccount) {
      return res.status(404).json({ error: 'Cuenta de WhatsApp no encontrada' });
    }
    
    // Actualizar solo el estado
    const updatedAccount = await storage.updateWhatsappAccount(accountId, { status });
    
    res.json(updatedAccount);
  } catch (error) {
    console.error('Error al actualizar estado de cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al actualizar estado de cuenta de WhatsApp' });
  }
});

// Eliminar una cuenta de WhatsApp
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const accountId = parseInt(id);
    
    // Verificar si la cuenta existe
    const existingAccount = await storage.getWhatsappAccount(accountId);
    
    if (!existingAccount) {
      return res.status(404).json({ error: 'Cuenta de WhatsApp no encontrada' });
    }
    
    // Eliminar la cuenta
    await storage.deleteWhatsappAccount(accountId);
    
    res.json({ success: true, message: 'Cuenta de WhatsApp eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al eliminar cuenta de WhatsApp' });
  }
});

// Generar código QR para una cuenta
router.post('/:id/generate-qr', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const accountId = parseInt(id);
    
    // Verificar si la cuenta existe
    const existingAccount = await storage.getWhatsappAccount(accountId);
    
    if (!existingAccount) {
      return res.status(404).json({ error: 'Cuenta de WhatsApp no encontrada' });
    }
    
    // Generar un código QR para esta cuenta
    // (Usando la implementación existente por ahora)
    const qrCodePath = path.join(process.cwd(), 'temp', 'whatsapp-qr.txt');
    let qrCodeData = "";
    
    try {
      // Intentar leer el código QR existente
      if (fs.existsSync(qrCodePath)) {
        qrCodeData = fs.readFileSync(qrCodePath, 'utf8');
      }
      
      if (!qrCodeData) {
        // Si no hay código QR, intentar obtener uno nuevo
        await whatsappService.getLatestQR();
        
        // Esperar un momento para que se genere el código QR
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Intentar leer el código QR generado
        if (fs.existsSync(qrCodePath)) {
          qrCodeData = fs.readFileSync(qrCodePath, 'utf8');
        }
      }
      
      // Actualizar el estado de la cuenta
      await storage.updateWhatsappAccount(accountId, { status: 'pending_auth' });
      
      res.json({ success: true, qrCode: qrCodeData, qrUrl: `/api/qrcode/raw` });
    } catch (error) {
      console.error('Error al generar código QR:', error);
      res.status(500).json({ error: 'Error al generar código QR' });
    }
  } catch (error) {
    console.error('Error al procesar solicitud de código QR:', error);
    res.status(500).json({ error: 'Error al procesar solicitud de código QR' });
  }
});

// Obtener chats disponibles para asignar
router.get('/chats/available', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;
    
    // Por ahora, solo usamos una cuenta, así que ignoramos el accountId
    // En una implementación completa, obtendríamos los chats específicos de esa cuenta
    
    const client = whatsappService.getClient();
    
    if (!client || !client.isReady) {
      return res.status(400).json({ 
        error: 'Cliente de WhatsApp no está listo',
        message: 'Por favor, asegúrese de que WhatsApp está conectado'
      });
    }
    
    // Obtener todos los chats
    const chats = await client.getChats();
    
    // Obtener chats ya asignados para excluirlos
    const assignedChats = await storage.getAllChatAssignments();
    const assignedChatIds = assignedChats.map(a => a.chatId);
    
    // Filtrar chats no asignados y solo mostrar chats individuales
    const availableChats = chats
      .filter(chat => !assignedChatIds.includes(chat.id._serialized) && !chat.isGroup)
      .map(chat => ({
        id: chat.id._serialized,
        name: chat.name || chat.id._serialized,
        unreadCount: chat.unreadCount || 0,
        lastMessage: chat.lastMessage ? {
          body: chat.lastMessage.body,
          timestamp: chat.lastMessage.timestamp
        } : null
      }));
    
    res.json(availableChats);
  } catch (error) {
    console.error('Error al obtener chats disponibles:', error);
    res.status(500).json({ error: 'Error al obtener chats disponibles' });
  }
});

export default router;