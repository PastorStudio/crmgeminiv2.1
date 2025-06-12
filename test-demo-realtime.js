/**
 * Prueba del sistema de creación automática de usuarios demo en tiempo real
 */

import { realtimeDemoCreator } from './server/services/realtimeDemoCreator.js';

async function testRealtimeDemoCreation() {
  console.log('🧪 Iniciando pruebas del sistema de creación automática de demos...\n');

  const testCases = [
    {
      message: "Hola, mi nombre es María García",
      expectedResult: true,
      description: "Nombre completo válido con indicador"
    },
    {
      message: "Me llamo Carlos Rodriguez Santos",
      expectedResult: true,
      description: "Nombre con tres palabras"
    },
    {
      message: "Soy Ana Martínez",
      expectedResult: true,
      description: "Nombre con indicador 'soy'"
    },
    {
      message: "Juan Pablo Pérez",
      expectedResult: true,
      description: "Solo nombre completo sin indicadores"
    },
    {
      message: "Hola, ¿cómo están?",
      expectedResult: false,
      description: "Mensaje sin nombre"
    },
    {
      message: "Mi nombre es Juan",
      expectedResult: false,
      description: "Solo un nombre (incompleto)"
    },
    {
      message: "Necesito información sobre sus servicios",
      expectedResult: false,
      description: "Consulta general"
    }
  ];

  let testsPassed = 0;
  let testsTotal = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const chatId = `test_chat_${i + 1}`;
    const messageId = `test_msg_${Date.now()}_${i}`;

    console.log(`\n--- Test ${i + 1}: ${testCase.description} ---`);
    console.log(`Mensaje: "${testCase.message}"`);

    try {
      const result = await realtimeDemoCreator.processMessage(
        testCase.message,
        chatId,
        messageId,
        1
      );

      console.log(`Resultado esperado: ${testCase.expectedResult ? 'Crear demo' : 'No crear demo'}`);
      console.log(`Resultado obtenido: ${result.shouldRespond ? 'Crear demo' : 'No crear demo'}`);

      if (result.shouldRespond === testCase.expectedResult) {
        console.log('✅ Test PASADO');
        testsPassed++;

        if (result.shouldRespond && result.responseMessage) {
          console.log(`📤 Mensaje de respuesta:\n${result.responseMessage.substring(0, 200)}...`);
        }
      } else {
        console.log('❌ Test FALLIDO');
      }

    } catch (error) {
      console.log('❌ Test FALLIDO con error:', error.message);
    }
  }

  console.log(`\n🏁 Resultados finales: ${testsPassed}/${testsTotal} tests pasaron`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 ¡Todos los tests pasaron! El sistema funciona correctamente.');
  } else {
    console.log('⚠️ Algunos tests fallaron. Revisar la implementación.');
  }

  // Mostrar estadísticas del procesador
  const stats = realtimeDemoCreator.getStats();
  console.log(`\n📊 Estadísticas: ${stats.processedMessages} mensajes procesados en total`);
}

// Ejecutar las pruebas
testRealtimeDemoCreation()
  .then(() => {
    console.log('\n✅ Pruebas completadas');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error en las pruebas:', error);
    process.exit(1);
  });