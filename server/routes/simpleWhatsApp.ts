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
    
    const newAccount = await storage.createWhatsAppAccount({
      name: validatedData.name,
      description: validatedData.description || '',
      ownerName: validatedData.ownerName,
      ownerPhone: validatedData.ownerPhone,
      status: 'inactive',
      autoResponseEnabled: false,
      responseDelay: 3,
      disableGroupResponses: false,
      targetLanguage: 'es',
      translateToSpanish: true,
      keepAliveEnabled: true,
      connectionAttempts: 0,
      maxReconnectAttempts: 5,
    });

    res.json({
      success: true,
      account: newAccount
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

    // Return a placeholder QR code for now
    res.json({
      success: true,
      qrcode: "2@l+eDYKX6QPa6dLDhOCxxG9yVZrg7cIKxONIDe7DWA5U3NKHoHMZ1B4Lk6nOmQpIrYu8bV2xW4e0jXnCf/V7w==,XU3NKHoHMZ1B4Lk6nOmQpIrYu8bV2xW4e0jXnCf/V7w==,DemoQRCode"
    });
  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener código QR'
    });
  }
});

export default router;