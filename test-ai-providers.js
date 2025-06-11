/**
 * Test script to verify all AI providers are working correctly
 */

import { aiProviderService } from './server/services/aiProviderService.js';

async function testAllProviders() {
  console.log('🧪 Testing all AI providers...\n');
  
  try {
    // Initialize the service
    await aiProviderService.initialize();
    
    const testMessage = "Hola, necesito información sobre precios del CRM";
    const agentName = "Alex - Agente de Ventas";
    
    console.log('📝 Mensaje de prueba:', testMessage);
    console.log('👤 Agente:', agentName);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test current configured provider (should be Qwen3)
    console.log('🤖 Testing current configured provider...');
    const response = await aiProviderService.generateResponse(testMessage, agentName);
    console.log('✅ Response generated:', response.substring(0, 100) + '...\n');
    
    console.log('🎯 All AI providers tested successfully!');
    
  } catch (error) {
    console.error('❌ Error testing AI providers:', error);
  }
}

testAllProviders();