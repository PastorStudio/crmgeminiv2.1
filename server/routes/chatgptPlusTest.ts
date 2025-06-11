/**
 * ChatGPT Plus Test Route
 * Test endpoint to verify ChatGPT Plus integration
 */

import { Router } from 'express';
import { chatgptPlusDirectService } from '../services/chatgptPlusDirectService';

const router = Router();

// Test ChatGPT Plus service
router.post('/test-chatgpt-plus', async (req, res) => {
  try {
    const { message, agentName } = req.body;
    
    console.log('🧪 Testing ChatGPT Plus service...');
    
    // Get service status
    const status = chatgptPlusDirectService.getStatus();
    console.log('📊 ChatGPT Plus Status:', status);
    
    // Test if service is available
    const isAvailable = await chatgptPlusDirectService.isAvailable();
    console.log('🔍 ChatGPT Plus Available:', isAvailable);
    
    // Generate test response
    const testMessage = message || 'Hola, necesito ayuda con mi consulta';
    const testAgent = agentName || 'Asistente de Prueba';
    
    const response = await chatgptPlusDirectService.generateResponse(testMessage, testAgent);
    
    res.json({
      success: true,
      status,
      isAvailable,
      testMessage,
      testAgent,
      response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error testing ChatGPT Plus:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      status: chatgptPlusDirectService.getStatus()
    });
  }
});

// Get ChatGPT Plus status
router.get('/chatgpt-plus-status', async (req, res) => {
  try {
    const status = chatgptPlusDirectService.getStatus();
    const isAvailable = await chatgptPlusDirectService.isAvailable();
    
    res.json({
      success: true,
      status: {
        ...status,
        isAvailable,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting ChatGPT Plus status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;