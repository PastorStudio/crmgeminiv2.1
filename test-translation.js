// Test translation service
const { translateText, autoTranslate } = require('./server/services/translationService');

async function testTranslation() {
  console.log('🧪 Testing translation service...');
  
  try {
    const result = await autoTranslate('Hola, ¿cómo estás?');
    console.log('✅ Translation successful:', result);
  } catch (error) {
    console.error('❌ Translation failed:', error.message);
  }
}

testTranslation();