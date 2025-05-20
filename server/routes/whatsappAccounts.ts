/**
 * Rutas para gestionar cuentas de WhatsApp
 */
import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { whatsappMultiAccountManager } from '../services/whatsappMultiAccountManager';
import whatsappServiceMulti from '../services/whatsappServiceMulti';

const router = Router();

// Obtener todas las cuentas de WhatsApp
router.get('/', async (req, res) => {
  try {
    const accounts = await storage.getAllWhatsappAccounts();
    
    // Obtener el estado actual de cada cuenta desde el administrador de múltiples cuentas
    const accountsWithStatus = accounts.map(account => {
      const statusInfo = whatsappMultiAccountManager.getStatus(account.id);
      return {
        ...account,
        currentStatus: statusInfo
      };
    });
    
    res.json(accountsWithStatus);
  } catch (error) {
    console.error('Error al obtener cuentas de WhatsApp:', error);
    res.status(500).json({ error: 'Error al obtener cuentas de WhatsApp' });
  }
});

// Obtener una cuenta específica de WhatsApp
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const account = await storage.getWhatsappAccount(id);
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    // Obtener estado actualizado desde el administrador de múltiples cuentas
    const statusInfo = whatsappMultiAccountManager.getStatus(id);
    
    res.json({
      ...account,
      currentStatus: statusInfo
    });
  } catch (error) {
    console.error('Error al obtener cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al obtener cuenta de WhatsApp' });
  }
});

// Esquema de validación para creación de cuentas
const accountSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  description: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  adminId: z.number().optional()
});

// Crear una nueva cuenta de WhatsApp
router.post('/', async (req, res) => {
  try {
    // Validar datos de entrada
    const validation = accountSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: validation.error.format() 
      });
    }
    
    // Crear cuenta en la base de datos
    const newAccount = await storage.createWhatsappAccount({
      ...validation.data,
      status: 'inactive',
      sessionData: {},
      createdAt: new Date()
    });
    
    res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error al crear cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al crear cuenta de WhatsApp' });
  }
});

// Actualizar una cuenta de WhatsApp
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Validar datos de entrada
    const validation = accountSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: validation.error.format() 
      });
    }
    
    // Actualizar cuenta en la base de datos
    const updatedAccount = await storage.updateWhatsappAccount(id, validation.data);
    if (!updatedAccount) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    res.json(updatedAccount);
  } catch (error) {
    console.error('Error al actualizar cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al actualizar cuenta de WhatsApp' });
  }
});

// Eliminar una cuenta de WhatsApp
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Primero desconectar la cuenta si está activa
    await whatsappMultiAccountManager.disconnectAccount(id);
    
    // Luego eliminar de la base de datos
    await storage.deleteWhatsappAccount(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al eliminar cuenta de WhatsApp' });
  }
});

// Inicializar una cuenta de WhatsApp
router.post('/:id/initialize', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Verificar que la cuenta existe
    const account = await storage.getWhatsappAccount(id);
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    // Inicializar la cuenta
    const success = await whatsappServiceMulti.initializeAccount(id);
    if (!success) {
      return res.status(500).json({ error: 'Error al inicializar cuenta' });
    }
    
    // Obtener estado actualizado
    const status = whatsappServiceMulti.getStatus(id);
    
    // Actualizar estado en base de datos
    await storage.updateWhatsappAccount(id, {
      status: 'pending_auth',
      sessionData: status
    });
    
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error al inicializar cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al inicializar cuenta de WhatsApp' });
  }
});

// Obtener código QR para una cuenta
router.get('/:id/qrcode', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Obtener código QR
    const qrCode = await whatsappServiceMulti.getLatestQR(id);
    if (!qrCode) {
      return res.status(404).json({ error: 'Código QR no disponible' });
    }
    
    // Respuesta con el código QR
    res.json({ success: true, qrcode: qrCode });
  } catch (error) {
    console.error('Error al obtener código QR:', error);
    res.status(500).json({ error: 'Error al obtener código QR' });
  }
});

// Obtener estado de una cuenta
router.get('/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Obtener estado actualizado
    const status = whatsappServiceMulti.getStatus(id);
    
    res.json(status);
  } catch (error) {
    console.error('Error al obtener estado de cuenta:', error);
    res.status(500).json({ error: 'Error al obtener estado de cuenta' });
  }
});

// Desconectar una cuenta
router.post('/:id/disconnect', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Desconectar la cuenta
    const success = await whatsappServiceMulti.disconnectAccount(id);
    if (!success) {
      return res.status(500).json({ error: 'Error al desconectar cuenta' });
    }
    
    // Actualizar estado en base de datos
    await storage.updateWhatsappAccount(id, {
      status: 'inactive',
      sessionData: { disconnectedAt: new Date().toISOString() }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al desconectar cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al desconectar cuenta de WhatsApp' });
  }
});

// Enviar mensaje desde una cuenta específica
router.post('/:id/send', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Validar datos de entrada
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Se requieren los campos "to" y "message"' });
    }
    
    // Enviar mensaje
    const result = await whatsappServiceMulti.sendMessage(id, to, message);
    
    res.json({ success: true, messageId: result.id?._serialized || result.id });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Obtener chats de una cuenta específica
router.get('/:id/chats', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Obtener chats
    const chats = await whatsappServiceMulti.getChats(id);
    
    res.json(chats);
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ error: 'Error al obtener chats' });
  }
});

// Obtener mensajes de un chat específico
router.get('/:id/messages/:chatId', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const { chatId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    // Obtener mensajes
    const messages = await whatsappServiceMulti.getChatMessages(id, chatId, limit);
    
    res.json(messages);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

export default router;