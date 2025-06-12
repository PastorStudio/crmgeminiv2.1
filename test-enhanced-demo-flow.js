/**
 * Test del enhancedDemoDetector para verificar el flujo correcto
 */

import { enhancedDemoDetector } from './server/services/enhancedDemoDetector.ts';

async function testEnhancedDemoFlow() {
  console.log('🧪 Testing Enhanced Demo Detector Flow...\n');

  try {
    // Test 1: Cliente solicita demo
    console.log('--- Test 1: Demo Request ---');
    const chatId = 'test_enhanced_123';
    const accountId = 1;
    
    const step1 = await enhancedDemoDetector.processMessage(
      'Quiero probar el sistema',
      chatId,
      accountId,
      '+1234567890'
    );

    console.log('Input: "Quiero probar el sistema"');
    console.log('Response:', step1 ? 'YES' : 'NO');
    if (step1) {
      console.log('Message:', step1.substring(0, 100) + '...');
    }

    // Test 2: Cliente proporciona nombre
    console.log('\n--- Test 2: Name Response ---');
    const step2 = await enhancedDemoDetector.processMessage(
      'Mi nombre es Pedro González',
      chatId,
      accountId,
      '+1234567890'
    );

    console.log('Input: "Mi nombre es Pedro González"');
    console.log('Response:', step2 ? 'YES' : 'NO');
    if (step2) {
      console.log('Message:', step2.substring(0, 100) + '...');
    }

    // Test 3: Mensaje normal (no demo)
    console.log('\n--- Test 3: Normal Message ---');
    const step3 = await enhancedDemoDetector.processMessage(
      'Hola, cómo están?',
      'another_chat_456',
      accountId,
      '+9876543210'
    );

    console.log('Input: "Hola, cómo están?"');
    console.log('Response:', step3 ? 'YES' : 'NO');

    console.log('\n✅ Enhanced Demo Detector tests completed');

  } catch (error) {
    console.error('❌ Error in test:', error);
  } finally {
    process.exit(0);
  }
}

testEnhancedDemoFlow();