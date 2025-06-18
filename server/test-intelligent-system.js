/**
 * Script de prueba para el sistema inteligente de respuestas automáticas
 */

import { messageSystemActivator } from './services/messageSystemActivator.js';
import { intelligentAutoResponse } from './services/intelligentAutoResponse.js';

async function testIntelligentResponses() {
  console.log('🧪 Iniciando pruebas del sistema inteligente de respuestas...');

  const testCases = [
    {
      accountId: 1,
      chatId: 'test_greeting',
      fromNumber: '+1234567890',
      message: 'Hola, buenos días',
      expected: 'greeting'
    },
    {
      accountId: 1,
      chatId: 'test_inquiry',
      fromNumber: '+1234567891',
      message: 'Necesito información sobre sus precios',
      expected: 'support'
    },
    {
      accountId: 1,
      chatId: 'test_sales',
      fromNumber: '+1234567892',
      message: 'Quiero comprar su producto, ¿cuánto cuesta?',
      expected: 'sales'
    },
    {
      accountId: 1,
      chatId: 'test_farewell',
      fromNumber: '+1234567893',
      message: 'Muchas gracias por la información, que tengas buen día',
      expected: 'farewell'
    }
  ];

  let passedTests = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Probando: "${testCase.message}"`);
      
      const response = await intelligentAutoResponse.processIncomingMessage(
        testCase.accountId,
        testCase.chatId,
        testCase.message,
        testCase.fromNumber
      );

      if (response) {
        console.log(`✅ Respuesta generada: "${response.message}"`);
        console.log(`📊 Estado: ${response.nextState}, Confianza: ${response.confidence}`);
        passedTests++;
      } else {
        console.log(`❌ No se generó respuesta para: "${testCase.message}"`);
      }
    } catch (error) {
      console.error(`❌ Error en prueba: ${error.message}`);
    }
  }

  console.log(`\n📈 Resultados: ${passedTests}/${testCases.length} pruebas exitosas`);
  
  if (passedTests === testCases.length) {
    console.log('🎉 Todas las pruebas pasaron correctamente');
  } else {
    console.log('⚠️ Algunas pruebas fallaron - revisar configuración');
  }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testIntelligentResponses().catch(console.error);
}

export { testIntelligentResponses };