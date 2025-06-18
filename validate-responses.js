/**
 * Validar que las respuestas no sean genéricas
 */

const testCases = [
  "Hola, buenos días",
  "Necesito información sobre precios",
  "¿Están abiertos?",
  "Buenas tardes"
];

async function validateResponses() {
  console.log('🔍 Validando respuestas del sistema...\n');
  
  for (let i = 0; i < testCases.length; i++) {
    const message = testCases[i];
    console.log(`Test ${i + 1}: "${message}"`);
    
    try {
      const response = await fetch('http://localhost:5000/api/intelligent/process-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 1,
          chatId: `test_${Date.now()}_${i}`,
          message: message,
          fromNumber: '+1234567890'
        })
      });

      const result = await response.json();
      
      if (result.success && result.response) {
        const aiMessage = result.response.message;
        console.log(`Respuesta: "${aiMessage}"`);
        
        // Verificar si es genérica
        const isGeneric = aiMessage.toLowerCase().includes('gracias por escribirnos') ||
                         aiMessage.toLowerCase().includes('le saluda') ||
                         aiMessage.toLowerCase().includes('departamento de') ||
                         aiMessage.toLowerCase().includes('sistema municipal');
        
        if (isGeneric) {
          console.log('❌ GENÉRICA detectada');
        } else {
          console.log('✅ Respuesta NATURAL');
        }
      } else {
        console.log('❌ Error en respuesta');
      }
      
      console.log('---');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

validateResponses();