/**
 * Test del sistema de conversación natural
 * Prueba el flujo completo: saludo, desarrollo, despedida
 */

import { conversationFlowManager } from './conversationFlowManager';

interface TestScenario {
  name: string;
  messages: string[];
  expectedPhases: string[];
}

const testScenarios: TestScenario[] = [
  {
    name: 'Conversación de ventas completa',
    messages: [
      'Hola, buenos días',
      'Necesito información sobre sus productos',
      '¿Qué precios manejan?',
      'Me interesa hacer una compra',
      '¿Tienen descuentos por volumen?',
      'Perfecto, gracias por la información',
      'Hasta luego'
    ],
    expectedPhases: ['greeting', 'development', 'development', 'development', 'development', 'farewell', 'farewell']
  },
  {
    name: 'Consulta técnica',
    messages: [
      'Hello',
      'I need technical support',
      'My system is not working properly',
      'Can you help me troubleshoot?',
      'Thank you for your help'
    ],
    expectedPhases: ['greeting', 'development', 'development', 'development', 'farewell']
  },
  {
    name: 'Consulta rápida',
    messages: [
      'Hi there',
      'What are your business hours?',
      'Thanks!'
    ],
    expectedPhases: ['greeting', 'development', 'farewell']
  }
];

export class NaturalConversationTest {
  
  /**
   * Ejecuta todas las pruebas de conversación
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Iniciando pruebas de conversación natural...\n');
    
    for (const scenario of testScenarios) {
      await this.runScenarioTest(scenario);
      console.log(''); // Línea en blanco entre escenarios
    }
    
    console.log('✅ Todas las pruebas completadas');
  }

  /**
   * Ejecuta un escenario de prueba específico
   */
  private async runScenarioTest(scenario: TestScenario): Promise<void> {
    console.log(`🎭 Probando escenario: ${scenario.name}`);
    console.log('─'.repeat(50));
    
    const chatId = `test-chat-${Date.now()}`;
    const accountId = 1;
    
    for (let i = 0; i < scenario.messages.length; i++) {
      const message = scenario.messages[i];
      const expectedPhase = scenario.expectedPhases[i];
      
      try {
        const result = await conversationFlowManager.processMessage(
          chatId,
          message,
          accountId
        );
        
        console.log(`👤 Usuario: ${message}`);
        console.log(`🤖 Bot: ${result.response}`);
        console.log(`📊 Fase: ${result.phase} | Confianza: ${result.confidence}%`);
        
        // Verificar si la fase coincide con la esperada
        if (result.phase === expectedPhase) {
          console.log(`✅ Fase correcta`);
        } else {
          console.log(`⚠️ Fase esperada: ${expectedPhase}, obtenida: ${result.phase}`);
        }
        
        console.log('');
        
        // Simular tiempo entre mensajes
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error en mensaje "${message}":`, error);
      }
    }
    
    // Mostrar estadísticas finales
    const stats = conversationFlowManager.getConversationStats();
    console.log(`📈 Estadísticas: ${stats.activeConversations} activas, promedio ${stats.averageMessageCount} mensajes`);
  }

  /**
   * Prueba de estrés con múltiples conversaciones simultáneas
   */
  async runStressTest(): Promise<void> {
    console.log('🚀 Iniciando prueba de estrés...');
    
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < 10; i++) {
      const promise = this.simulateConversation(`stress-chat-${i}`, i + 1);
      promises.push(promise);
    }
    
    await Promise.all(promises);
    
    const stats = conversationFlowManager.getConversationStats();
    console.log(`📊 Prueba de estrés completada: ${stats.activeConversations} conversaciones activas`);
  }

  /**
   * Simula una conversación completa
   */
  private async simulateConversation(chatId: string, accountId: number): Promise<void> {
    const messages = [
      'Hola',
      '¿Pueden ayudarme?',
      'Necesito información',
      'Gracias'
    ];
    
    for (const message of messages) {
      try {
        await conversationFlowManager.processMessage(chatId, message, accountId);
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Error en conversación ${chatId}:`, error);
      }
    }
  }

  /**
   * Prueba con diferentes idiomas
   */
  async runLanguageTest(): Promise<void> {
    console.log('🌍 Probando respuestas en diferentes contextos...');
    
    const multilingualMessages = [
      { text: 'Hello, I need help', expected: 'greeting' },
      { text: 'Hola, ¿cómo están?', expected: 'greeting' },
      { text: 'Buenos días, necesito información', expected: 'greeting' },
      { text: 'What services do you offer?', expected: 'development' },
      { text: '¿Cuáles son sus precios?', expected: 'development' },
      { text: 'Thank you very much', expected: 'farewell' },
      { text: 'Muchas gracias, adiós', expected: 'farewell' }
    ];
    
    const chatId = `multilingual-test-${Date.now()}`;
    
    for (const msgTest of multilingualMessages) {
      try {
        const result = await conversationFlowManager.processMessage(
          chatId,
          msgTest.text,
          1
        );
        
        console.log(`🗣️ ${msgTest.text}`);
        console.log(`🤖 ${result.response}`);
        console.log(`📝 Fase: ${result.phase} (esperada: ${msgTest.expected})`);
        console.log('');
        
      } catch (error) {
        console.error(`Error procesando "${msgTest.text}":`, error);
      }
    }
  }
}

// Función para ejecutar pruebas desde la consola
export async function testNaturalConversation(): Promise<void> {
  const tester = new NaturalConversationTest();
  
  try {
    await tester.runAllTests();
    await tester.runLanguageTest();
    await tester.runStressTest();
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}