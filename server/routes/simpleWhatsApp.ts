/**
 * Simplified WhatsApp routes for account creation
 */
import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Schema for creating WhatsApp account
const createAccountSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerName: z.string().min(1),
  ownerPhone: z.string().min(1),
});

// Get all WhatsApp accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await storage.getWhatsAppAccounts();
    res.json({
      success: true,
      accounts: accounts || []
    });
  } catch (error) {
    console.error('Error fetching WhatsApp accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cuentas de WhatsApp',
      details: error instanceof Error ? error.message : 'Unknown error',
      accounts: []
    });
  }
});

// Create new WhatsApp account
router.post('/', async (req, res) => {
  try {
    const validatedData = createAccountSchema.parse(req.body);
    
    // Get user identification from request
    let userId = null;
    let currentUser = 'Sistema';
    
    // Try to get user from session
    if (req.session && req.session.user) {
      userId = req.session.user.id;
      currentUser = req.session.user.name || req.session.user.email || `Usuario ${userId}`;
    }
    // Try to get user from custom header
    else if (req.headers['x-user-id']) {
      userId = parseInt(req.headers['x-user-id'] as string);
      currentUser = req.headers['x-user-name'] as string || `Usuario ${userId}`;
    }
    // Create a user session based on owner name
    else {
      userId = Math.floor(Math.random() * 1000) + 1;
      currentUser = validatedData.ownerName;
      
      // Initialize session if it doesn't exist
      if (!req.session) {
        req.session = {} as any;
      }
      req.session.user = {
        id: userId,
        name: currentUser,
        email: `${validatedData.ownerName.toLowerCase().replace(/\s+/g, '')}@demo.com`
      };
    }

    console.log(`👤 Usuario identificado: ${currentUser} (ID: ${userId})`);
    
    const newAccount = await storage.createWhatsAppAccount({
      name: validatedData.name,
      description: validatedData.description || '',
      ownerName: validatedData.ownerName,
      ownerPhone: validatedData.ownerPhone,
      status: 'inactive',
      userId: userId,
      autoResponseEnabled: false,
      responseDelay: 3,
      disableGroupResponses: false,
      targetLanguage: 'es',
      translateToSpanish: true,
      keepAliveEnabled: true,
      connectionAttempts: 0,
      maxReconnectAttempts: 5,
    });

    console.log(`✅ Cuenta de WhatsApp creada para usuario ${currentUser} con ID: ${newAccount.id}`);

    res.json({
      success: true,
      account: newAccount,
      user: currentUser
    });
  } catch (error) {
    console.error('Error creating WhatsApp account:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear cuenta de WhatsApp',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete WhatsApp account
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID inválido' 
      });
    }

    await storage.deleteWhatsappAccount(id);
    
    res.json({
      success: true,
      message: 'Cuenta eliminada correctamente'
    });
  } catch (error) {
    console.error('Error deleting WhatsApp account:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar cuenta de WhatsApp',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get QR code for account
router.get('/:id/qrcode', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID inválido' 
      });
    }

    // Get real QR code from WhatsApp Web client
    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    
    try {
      // First try to get QR with image
      const qrData = await whatsappMultiAccountManager.getQRWithImage(id);
      
      if (qrData && qrData.qrcode) {
        console.log(`✅ QR code obtenido para cuenta ${id}`);
        res.json({
          success: true,
          qrcode: qrData.qrcode,
          qrDataUrl: qrData.qrDataUrl,
          status: 'ready'
        });
        return;
      }

      // If no QR available, try to get latest QR
      const latestQR = await whatsappMultiAccountManager.getLatestQR(id);
      
      if (latestQR) {
        console.log(`✅ QR code texto obtenido para cuenta ${id}`);
        res.json({
          success: true,
          qrcode: latestQR,
          qrDataUrl: null,
          status: 'ready'
        });
        return;
      }

      // If still no QR, initialize the account
      console.log(`🔄 Inicializando cuenta WhatsApp ${id} para generar QR`);
      await whatsappMultiAccountManager.initializeAccount(id);
      
      res.json({
        success: true,
        qrcode: null,
        message: 'Inicializando cuenta WhatsApp. Solicite el QR nuevamente en unos segundos.',
        status: 'initializing'
      });
      
    } catch (qrError) {
      console.error('Error getting QR from WhatsApp manager:', qrError);
      
      res.json({
        success: false,
        error: 'Error al obtener código QR de WhatsApp Web',
        details: qrError instanceof Error ? qrError.message : 'Unknown error',
        status: 'error'
      });
    }
  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener código QR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete all WhatsApp accounts
router.delete('/delete-all', async (req, res) => {
  try {
    console.log('🗑️ Iniciando eliminación completa de todas las cuentas de WhatsApp...');
    
    // Get all accounts before deleting them
    const allAccounts = await storage.getWhatsAppAccounts();
    
    if (!allAccounts || allAccounts.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No hay cuentas para eliminar',
        deletedCount: 0
      });
    }

    // Import WhatsApp manager
    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    
    // Disconnect all active accounts
    for (const account of allAccounts) {
      try {
        await whatsappMultiAccountManager.disconnectAccount(account.id);
        console.log(`✅ Cuenta ${account.id} (${account.name}) desconectada`);
      } catch (error) {
        console.error(`⚠️ Error desconectando cuenta ${account.id}:`, error);
      }
    }
    
    // Delete all accounts from database
    await storage.deleteAllWhatsappAccounts();
    
    // Clean session folders
    try {
      const { join } = await import('path');
      const { existsSync, rmSync } = await import('fs');
      
      const TEMP_DIR = join(process.cwd(), 'temp');
      const ACCOUNTS_DIR = join(TEMP_DIR, 'whatsapp-accounts');
      
      if (existsSync(ACCOUNTS_DIR)) {
        rmSync(ACCOUNTS_DIR, { recursive: true, force: true });
        console.log('🧹 Carpetas de sesión eliminadas');
      }
    } catch (cleanError) {
      console.warn('⚠️ Error limpiando carpetas de sesión:', cleanError);
    }
    
    console.log('✅ Todas las cuentas eliminadas correctamente');
    
    res.json({ 
      success: true, 
      message: 'Todas las cuentas han sido eliminadas correctamente',
      deletedCount: allAccounts.length
    });
  } catch (error) {
    console.error('❌ Error al eliminar todas las cuentas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al eliminar todas las cuentas de WhatsApp',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Delete ALL WhatsApp accounts - specific route to avoid conflicts
router.delete('/delete-all', async (req, res) => {
  try {
    console.log('🗑️ DELETE ALL - Iniciando eliminación completa de todas las cuentas de WhatsApp...');
    
    // Get all accounts before deleting them
    const allAccounts = await storage.getWhatsAppAccounts();
    
    if (!allAccounts || allAccounts.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No hay cuentas para eliminar',
        deletedCount: 0
      });
    }

    // Import WhatsApp manager
    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    
    // Disconnect all active accounts
    for (const account of allAccounts) {
      try {
        await whatsappMultiAccountManager.disconnectAccount(account.id);
        console.log(`✅ Cuenta ${account.id} (${account.name}) desconectada`);
      } catch (error) {
        console.error(`⚠️ Error desconectando cuenta ${account.id}:`, error);
      }
    }
    
    // Delete all accounts from database
    await storage.deleteAllWhatsappAccounts();
    
    // Clean session folders
    try {
      const { join } = await import('path');
      const { existsSync, rmSync } = await import('fs');
      
      const TEMP_DIR = join(process.cwd(), 'temp');
      const ACCOUNTS_DIR = join(TEMP_DIR, 'whatsapp-accounts');
      
      if (existsSync(ACCOUNTS_DIR)) {
        rmSync(ACCOUNTS_DIR, { recursive: true, force: true });
        console.log('🧹 Carpetas de sesión eliminadas');
      }
    } catch (cleanError) {
      console.warn('⚠️ Error limpiando carpetas de sesión:', cleanError);
    }
    
    console.log('✅ Todas las cuentas eliminadas correctamente');
    
    return res.json({ 
      success: true, 
      message: 'Todas las cuentas han sido eliminadas correctamente',
      deletedCount: allAccounts.length
    });
  } catch (error) {
    console.error('❌ Error al eliminar todas las cuentas:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al eliminar todas las cuentas de WhatsApp',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Delete specific WhatsApp account
router.delete('/:id', async (req, res) => {
  console.log(`🔍 DELETE request received for ID: "${req.params.id}"`);
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'ID inválido' 
      });
    }
    
    // Import WhatsApp manager
    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    
    // First disconnect the account if it's active
    try {
      await whatsappMultiAccountManager.disconnectAccount(id);
      console.log(`✅ Cuenta ${id} desconectada antes de eliminar`);
    } catch (disconnectError) {
      console.warn(`⚠️ Error desconectando cuenta ${id}:`, disconnectError);
    }
    
    // Then delete from database
    await storage.deleteWhatsappAccount(id);
    
    console.log(`✅ Cuenta ${id} eliminada de la base de datos`);
    
    res.json({ 
      success: true,
      message: `Cuenta ${id} eliminada correctamente`
    });
  } catch (error) {
    console.error('❌ Error al eliminar cuenta de WhatsApp:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al eliminar cuenta de WhatsApp',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;