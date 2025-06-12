/**
 * Simple test para verificar QWEN3 API directamente
 */

async function testQwen3Direct() {
  console.log('🧪 Testing QWEN3 API integration...');

  const apiKey = process.env.QWEN3_API_KEY;
  
  if (!apiKey) {
    console.log('❌ QWEN3_API_KEY not found in environment');
    return;
  }

  console.log('✅ QWEN3_API_KEY configured');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://geminicrm.online',
        'X-Title': 'WhatsApp CRM AI'
      },
      body: JSON.stringify({
        model: 'qwen/qwen-2.5-72b-instruct',
        messages: [
          { role: 'system', content: 'Eres un asistente de IA profesional.' },
          { role: 'user', content: '¿Cuál es tu nombre y cómo puedes ayudarme?' }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API Error: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    console.log('📥 QWEN3 Response:');
    console.log('-----------------------------------');
    console.log(aiResponse);
    console.log('-----------------------------------');
    console.log('✅ QWEN3 integration working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQwen3Direct();