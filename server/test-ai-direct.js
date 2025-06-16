/**
 * Direct AI testing script to verify credentials and connections
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

// Test Gemini API
async function testGeminiAPI() {
  try {
    console.log('🔍 Testing Gemini API...');
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "Hola, soy Zoe del sistema CRM WhatsApp AI. ¿Cómo puedo ayudarte?";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini API working correctly');
    console.log('Response:', text.substring(0, 100) + '...');
    return { success: true, provider: 'gemini', response: text };
  } catch (error) {
    console.error('❌ Gemini API failed:', error.message);
    return { success: false, provider: 'gemini', error: error.message };
  }
}

// Test DeepSeek API
async function testDeepSeekAPI() {
  try {
    console.log('🔍 Testing DeepSeek API...');
    
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY not found');
    }

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'Eres Zoe, un agente virtual del sistema CRM WhatsApp AI.'
        },
        {
          role: 'user', 
          content: 'Hola, necesito información sobre el sistema CRM'
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ DeepSeek API working correctly');
    console.log('Response:', aiResponse.substring(0, 100) + '...');
    return { success: true, provider: 'deepseek', response: aiResponse };
  } catch (error) {
    console.error('❌ DeepSeek API failed:', error.response?.data || error.message);
    return { success: false, provider: 'deepseek', error: error.response?.data || error.message };
  }
}

// Test OpenAI API
async function testOpenAIAPI() {
  try {
    console.log('🔍 Testing OpenAI API...');
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found');
    }

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Eres Zoe, un agente virtual del sistema CRM WhatsApp AI.'
        },
        {
          role: 'user',
          content: 'Hola, necesito información sobre el sistema CRM'
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ OpenAI API working correctly');
    console.log('Response:', aiResponse.substring(0, 100) + '...');
    return { success: true, provider: 'openai', response: aiResponse };
  } catch (error) {
    console.error('❌ OpenAI API failed:', error.response?.data || error.message);
    return { success: false, provider: 'openai', error: error.response?.data || error.message };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting AI API tests...\n');
  
  const results = [];
  
  results.push(await testGeminiAPI());
  console.log('');
  
  results.push(await testDeepSeekAPI());
  console.log('');
  
  results.push(await testOpenAIAPI());
  console.log('');
  
  console.log('📊 Test Results Summary:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.provider.toUpperCase()}: ${result.success ? 'Working' : result.error}`);
  });
  
  return results;
}

// Export for use in other modules
export { testGeminiAPI, testDeepSeekAPI, testOpenAIAPI, runAllTests };

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}