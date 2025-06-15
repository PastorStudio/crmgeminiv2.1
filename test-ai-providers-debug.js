/**
 * Test directo de proveedores AI para identificar problemas específicos
 */

import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

async function testAIProviders() {
  console.log('🧪 PROBANDO PROVEEDORES AI DIRECTAMENTE');
  console.log('='.repeat(50));

  // Test Gemini directo
  console.log('\n🔍 Probando Gemini...');
  try {
    const geminiTest = `
    import { GoogleGenerativeAI } from '@google/generative-ai';
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    if (!process.env.GEMINI_API_KEY) {
      console.log('❌ GEMINI_API_KEY no está configurada');
      process.exit(1);
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Responde con "Hola desde Gemini"');
    console.log('✅ Gemini funcional:', result.response.text());
    `;
    
    await execPromise(`echo '${geminiTest}' > temp-gemini-test.js && node temp-gemini-test.js`);
  } catch (error) {
    console.log('❌ Error con Gemini:', error.message);
  }

  // Test variables de entorno
  console.log('\n🔑 Verificando variables de entorno...');
  try {
    const envTest = await execPromise('env | grep -E "(GEMINI|OPENAI|QWEN|DEEPSEEK)" || echo "No AI keys found"');
    console.log('Variables AI encontradas:', envTest.stdout);
  } catch (error) {
    console.log('❌ Error verificando variables:', error.message);
  }

  console.log('\n🏁 Test completado');
}

testAIProviders();