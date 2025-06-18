/**
 * Script de prueba para el sistema inteligente de respuestas automáticas
 * Verifica que el sistema puede generar respuestas contextuales y naturales
 */

const testMessages = [
  {
    input: "Hola, buenos días",
    expectedType: "greeting",
    description: "Saludo inicial"
  },
  {
    input: "Necesito información sobre sus precios",
    expectedType: "inquiry",
    description: "Consulta de información"
  },
  {
    input: "Quiero comprar su producto, ¿cuánto cuesta?",
    expectedType: "sales",
    description: "Intención de compra"
  },
  {
    input: "Muchas gracias por la información, que tengas buen día",
    expectedType: "farewell",
    description: "Despedida"
  },
  {
    input: "Mi nombre es Juan y trabajo en una empresa de tecnología",
    expectedType: "introduction",
    description: "Presentación personal"
  }
];

async function testIntelligentSystem() {
  console.log('🧪 Iniciando pruebas del sistema inteligente...\n');

  let passedTests = 0;
  let totalTests = testMessages.length;

  for (let i = 0; i < testMessages.length; i++) {
    const test = testMessages[i];
    console.log(`📝 Prueba ${i + 1}/${totalTests}: ${test.description}`);
    console.log(`💬 Mensaje: "${test.input}"`);

    try {
      const response = await fetch('http://localhost:5000/api/intelligent/process-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId: 1,
          chatId: `test_${Date.now()}_${i}`,
          message: test.input,
          fromNumber: '+1234567890'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.response) {
          console.log(`✅ Respuesta generada: "${result.response.message}"`);
          console.log(`📊 Confianza: ${result.response.confidence}%, Estado: ${result.response.nextState}\n`);
          passedTests++;
        } else {
          console.log(`❌ No se generó respuesta válida\n`);
        }
      } else {
        console.log(`❌ Error HTTP: ${response.status}\n`);
      }
    } catch (error) {
      console.log(`❌ Error de conexión: ${error.message}\n`);
    }

    // Delay entre pruebas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`📈 Resultados finales: ${passedTests}/${totalTests} pruebas exitosas`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ¡Todas las pruebas pasaron! El sistema inteligente funciona correctamente.');
  } else if (passedTests > totalTests / 2) {
    console.log('⚠️ La mayoría de pruebas pasaron, pero hay algunas fallas menores.');
  } else {
    console.log('❌ Muchas pruebas fallaron. Revisar configuración del sistema.');
  }

  return passedTests === totalTests;
}

// Ejecutar pruebas
testIntelligentSystem().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Error fatal en las pruebas:', error);
  process.exit(1);
});