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
    
    // Sincronizar carpetas de sesión con los nuevos IDs
    await syncSessionFolders();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar cuenta de WhatsApp:', error);
    res.status(500).json({ error: 'Error al eliminar cuenta de WhatsApp' });
  }
});

/**
 * Sincroniza las carpetas de sesión con los IDs actualizados
 * Esta función se llama después de eliminar una cuenta y reorganizar los IDs
 */
async function syncSessionFolders() {
  try {
    console.log("Sincronizando carpetas de sesión con IDs reorganizados...");
    
    // Importar módulos necesarios
    const path = require('path');
    const fs = require('fs');
    
    // Definir directorio de cuentas
    const TEMP_DIR = path.join(process.cwd(), 'temp');
    const ACCOUNTS_DIR = path.join(TEMP_DIR, 'whatsapp-accounts');
    
    // Obtener todas las cuentas con sus IDs actualizados
    const accounts = await storage.getAllWhatsappAccounts();
    accounts.sort((a, b) => a.id - b.id);
    
    // Para cada cuenta, asegurar que su carpeta tenga el nombre correcto
    for (const account of accounts) {
      const expectedFolderPath = path.join(ACCOUNTS_DIR, `account_${account.id}`);
      
      // Buscar posibles carpetas antiguas para esta cuenta 
      for (let i = 1; i <= 10; i++) {
        // Evitar revisar la carpeta con el ID correcto
        if (i === account.id) continue;
        
        const oldFolderPath = path.join(ACCOUNTS_DIR, `account_${i}`);
        
        // Si existe una carpeta con nombre antiguo y no existe la nueva
        if (fs.existsSync(oldFolderPath) && !fs.existsSync(expectedFolderPath)) {
          // Intentar determinar si esta carpeta pertenece a esta cuenta
          const oldSessionFile = path.join(oldFolderPath, 'session_status.json');
          
          if (fs.existsSync(oldSessionFile)) {
            try {
              const sessionData = JSON.parse(fs.readFileSync(oldSessionFile, 'utf8'));
              
              // Si la carpeta pertenece a esta cuenta o no hay forma de saberlo
              // (en el peor caso, es mejor reasignar la carpeta)
              if (!sessionData.name || sessionData.name === account.name) {
                console.log(`Renombrando carpeta de cuenta ${account.name} de ${oldFolderPath} a ${expectedFolderPath}`);
                fs.renameSync(oldFolderPath, expectedFolderPath);
                break; // Carpeta encontrada y actualizada
              }
            } catch (readError) {
              // Si no podemos leer el archivo, asumimos que podría ser la carpeta correcta
              console.log(`No se pudo leer datos de ${oldSessionFile}, renombrando ${oldFolderPath} a ${expectedFolderPath}`);
              fs.renameSync(oldFolderPath, expectedFolderPath);
              break;
            }
          } else {
            // Si no hay archivo de estado, asumimos que podría ser la carpeta correcta
            console.log(`Sin datos de sesión en ${oldFolderPath}, renombrando a ${expectedFolderPath}`);
            fs.renameSync(oldFolderPath, expectedFolderPath);
            break;
          }
        }
      }
      
      // Si después de la búsqueda, la carpeta esperada no existe, crearla
      if (!fs.existsSync(expectedFolderPath)) {
        console.log(`Creando nueva carpeta para cuenta ${account.name} en ${expectedFolderPath}`);
        fs.mkdirSync(expectedFolderPath, { recursive: true });
      }
    }
    
    console.log("Sincronización de carpetas de sesión completada");
    
    // Reiniciar el administrador de cuentas (opcional, pero asegura consistencia)
    if (accounts.length > 0) {
      console.log("Reiniciando administrador de cuentas para aplicar cambios...");
      
      // Reiniciar las cuentas activas
      for (const account of accounts) {
        if (account.status === 'active' || account.status === 'pending_auth') {
          try {
            await whatsappMultiAccountManager.disconnectAccount(account.id);
            await whatsappMultiAccountManager.initializeAccount(account.id);
          } catch (error) {
            console.error(`Error al reiniciar cuenta ${account.id} (${account.name}):`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error al sincronizar carpetas de sesión:", error);
  }
}

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

// Reinicializar una cuenta (forzar regeneración de QR)
router.post('/:id/reinitialize', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    console.log(`Solicitud para reinicializar cuenta ID ${id}`);
    
    // Primero desconectar si está conectada
    await whatsappServiceMulti.disconnectAccount(id);
    
    // Forzar eliminación de sesión anterior
    try {
      const account = await storage.getWhatsappAccount(id);
      if (account) {
        // Actualizar estado en BD para forzar nueva sesión
        await storage.updateWhatsappAccount(id, {
          status: 'initializing',
          sessionData: { forceNewSession: true, lastReset: new Date().toISOString() }
        });
      }
    } catch (dbError) {
      console.error(`Error actualizando BD para reinicialización de cuenta ${id}:`, dbError);
    }
    
    // Intentar inicializar nuevamente
    try {
      // Inicializar la cuenta en lugar de usar attemptConnectionRecovery
      await whatsappServiceMulti.initializeAccount(id);
      
      // Esperar un momento para que comience la inicialización
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar estado actual
      const status = whatsappServiceMulti.getStatus(id);
      
      res.json({ 
        success: true, 
        message: 'Cuenta reinicializada correctamente',
        status
      });
    } catch (initError) {
      console.error(`Error reinicializando cuenta ${id}:`, initError);
      res.status(500).json({ 
        success: false, 
        message: 'Error al reinicializar la cuenta. Intente nuevamente.' 
      });
    }
  } catch (error) {
    console.error('Error al reinicializar cuenta de WhatsApp:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al reinicializar cuenta de WhatsApp' 
    });
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

// Esquema de validación para conexión por teléfono
const phoneConnectRequestSchema = z.object({
  phoneNumber: z.string().min(8, 'Ingrese un número de teléfono válido')
});

// Esquema de validación para verificación de código
const phoneConnectVerifySchema = z.object({
  phoneNumber: z.string().min(8, 'Ingrese un número de teléfono válido'),
  code: z.string().length(8, 'El código debe tener 8 dígitos')
});

// Solicitar código de conexión por teléfono
router.post('/:id/phone-connect/request', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    // Validar datos de entrada
    const validation = phoneConnectRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false,
        message: 'Datos inválidos', 
        details: validation.error.format() 
      });
    }
    
    const { phoneNumber } = validation.data;
    
    // Verificar que la cuenta existe
    const account = await storage.getWhatsappAccount(id);
    if (!account) {
      return res.status(404).json({ 
        success: false,
        message: 'Cuenta no encontrada' 
      });
    }
    
    // Enviar solicitud de código al servicio WhatsApp
    const result = await whatsappMultiAccountManager.requestPhoneNumberCode(id, phoneNumber);
    
    if (result.success) {
      // Actualizar los datos de la cuenta con el número de teléfono para la siguiente etapa
      await storage.updateWhatsappAccount(id, {
        ownerPhone: phoneNumber,
        status: 'pending_auth',
        sessionData: {
          ...account.sessionData,
          phoneConnectRequestedAt: new Date().toISOString(),
          phoneNumber
        }
      });
      
      res.json({
        success: true,
        message: 'Código solicitado exitosamente. Revisa tu WhatsApp.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'No se pudo solicitar el código. Intente nuevamente.'
      });
    }
  } catch (error) {
    console.error('Error al solicitar código para conexión por teléfono:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al solicitar código para conexión por teléfono'
    });
  }
});

// Verificar código y completar conexión
router.post('/:id/phone-connect/verify', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'ID inválido' 
      });
    }
    
    // Validar datos de entrada
    const validation = phoneConnectVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false,
        message: 'Datos inválidos', 
        details: validation.error.format() 
      });
    }
    
    const { phoneNumber, code } = validation.data;
    
    // Verificar código en el servicio WhatsApp
    const result = await whatsappMultiAccountManager.verifyPhoneNumberCode(id, phoneNumber, code);
    
    if (result.success) {
      // Actualizar estado de la cuenta a conectada
      await storage.updateWhatsappAccount(id, {
        status: 'active',
        sessionData: {
          authenticated: true,
          authenticatedAt: new Date().toISOString(),
          authMethod: 'phone_code',
          phoneNumber
        }
      });
      
      res.json({
        success: true,
        message: 'Conexión completada exitosamente'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Código inválido o expirado. Intente nuevamente.'
      });
    }
  } catch (error) {
    console.error('Error al verificar código para conexión por teléfono:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al verificar código para conexión por teléfono'
    });
  }
});

export default router;