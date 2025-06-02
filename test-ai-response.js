/**
 * Test simple para verificar respuestas AI
 */

async function testAIResponse() {
  try {
    console.log('🧪 Iniciando test de respuesta AI...');
    
    const { intelligentResponseService } = await import('./server/services/intelligentResponseService.js');
    
    const testContext = {
      chatId: 'test-chat',
      accountId: 1,
      userMessage: 'Hola, necesito información sobre sus servicios de internet'
    };
    
    console.log('📝 Contexto de prueba:', testContext);
    
    const response = await intelligentResponseService.generateResponse(testContext);
    
    console.log('✅ Respuesta recibida:', response);
    
    if (response.message && response.message.length > 50) {
      console.log('🎉 SUCCESS: El sistema AI está funcionando correctamente');
      console.log('Proveedor usado:', response.provider);
      console.log('Mensaje:', response.message.substring(0, 100) + '...');
    } else {
      console.log('❌ FAILURE: El sistema AI no está generando respuestas válidas');
      console.log('Respuesta completa:', response);
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAIResponse();