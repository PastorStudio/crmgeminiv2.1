import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Ruta de prueba para obtener todas las cuentas de WhatsApp
router.get('/whatsapp-accounts', async (req, res) => {
  try {
    console.log('Ejecutando ruta de prueba para obtener cuentas WhatsApp');
    const accounts = await storage.getAllWhatsappAccounts();
    console.log('Cuentas obtenidas:', accounts.length);
    res.json(accounts);
  } catch (error) {
    console.error('Error en ruta de prueba de cuentas WhatsApp:', error);
    res.status(500).json({ error: 'Error al obtener cuentas de WhatsApp', details: error.message });
  }
});

// Ruta de prueba para obtener una cuenta específica
router.get('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    console.log(`Ejecutando ruta de prueba para obtener cuenta WhatsApp ID ${id}`);
    const account = await storage.getWhatsappAccount(id);
    
    if (!account) {
      console.log(`Cuenta con ID ${id} no encontrada`);
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    console.log(`Cuenta obtenida:`, account.id);
    res.json(account);
  } catch (error) {
    console.error(`Error en ruta de prueba para cuenta WhatsApp ID ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al obtener cuenta de WhatsApp', details: error.message });
  }
});

export default router;