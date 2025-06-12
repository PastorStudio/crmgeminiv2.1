/**
 * Test script para verificar la integración de QWEN3 API
 */

import { AIProviderService } from './server/services/aiProviderService.js';

async function testQwen3Integration() {
  console.log('🧪 Iniciando test de integración QWEN3...');

  try {
    // Crear instancia del servicio AI
    const aiService = new AIProviderService();
    
    // Inicializar el servicio
    await aiService.initialize();
    console.log('✅ Servicio AI inicializado correctamente');

    // Forzar configuración para usar QWEN3
    aiService.config = {
      selectedProvider: 'qwen3',
      qwenApiKey: process.env.QWEN3_API_KEY,
      customPrompt: 'Eres un asistente de IA profesional.',
      temperature: 0.7
    };

    console.log('🔑 Usando QWEN3 API Key:', process.env.QWEN3_API_KEY ? 'Configurada ✅' : 'No configurada ❌');

    // Test de respuesta básica
    console.log('📤 Enviando mensaje de prueba a QWEN3...');
    const testMessage = '¿Cuál es tu nombre y cómo puedes ayudarme?';
    
    const response = await aiService.generateResponse(testMessage, 'QWEN3 Assistant');
    
    console.log('📥 Respuesta recibida de QWEN3:');
    console.log('-----------------------------------');
    console.log(response);
    console.log('-----------------------------------');

    // Verificar que la respuesta no es fallback
    if (response.includes('Lo siento, no pude generar una respuesta') || 
        response.includes('Un representante te contactará')) {
      console.log('⚠️ La respuesta parece ser un fallback, verificar configuración');
    } else {
      console.log('✅ QWEN3 está funcionando correctamente');
    }

  } catch (error) {
    console.error('❌ Error durante el test de QWEN3:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('💡 Sugerencia: Verificar que QWEN3_API_KEY esté configurada correctamente');
    }
  }
}

// Ejecutar test
testQwen3Integration().then(() => {
  console.log('🏁 Test de QWEN3 completado');
  process.exit(0);
}).catch(error => {
  console.error('💥 Error fatal en test:', error);
  process.exit(1);
});