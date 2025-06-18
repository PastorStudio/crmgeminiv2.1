/**
 * Direct test of all 4 AI providers with existing keys
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import axios from 'axios';

async function testAllProviders() {
  console.log('🧪 Testing all 4 AI providers directly...\n');
  
  const testMessage = "Hola, necesito información sobre precios";
  const results = {};

  // Test 1: Gemini
  console.log('1️⃣ Testing Gemini...');
  try {
    const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `Eres un asistente de WhatsApp natural. Responde brevemente y sin frases genéricas.

Usuario: "${testMessage}"

Responde en máximo 120 caracteres:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    results.gemini = { success: true, response: text };
    console.log(`✅ Gemini: "${text}"`);
  } catch (error) {
    results.gemini = { success: false, error: error.message };
    console.log(`❌ Gemini failed: ${error.message}`);
  }

  // Test 2: OpenAI
  console.log('\n2️⃣ Testing OpenAI...');
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un asistente de WhatsApp natural. Responde brevemente y sin frases genéricas." },
        { role: "user", content: testMessage }
      ],
      temperature: 0.8,
      max_tokens: 100
    });

    const text = completion.choices[0]?.message?.content?.trim();
    results.openai = { success: true, response: text };
    console.log(`✅ OpenAI: "${text}"`);
  } catch (error) {
    results.openai = { success: false, error: error.message };
    console.log(`❌ OpenAI failed: ${error.message}`);
  }

  // Test 3: DeepSeek
  console.log('\n3️⃣ Testing DeepSeek...');
  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Eres un asistente de WhatsApp natural. Responde brevemente y sin frases genéricas.' },
        { role: 'user', content: testMessage }
      ],
      temperature: 0.8,
      max_tokens: 100
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const text = response.data?.choices?.[0]?.message?.content?.trim();
    results.deepseek = { success: true, response: text };
    console.log(`✅ DeepSeek: "${text}"`);
  } catch (error) {
    results.deepseek = { success: false, error: error.response?.data || error.message };
    console.log(`❌ DeepSeek failed: ${JSON.stringify(error.response?.data || error.message)}`);
  }

  // Test 4: Qwen (with fallback if no key)
  console.log('\n4️⃣ Testing Qwen...');
  if (process.env.QWEN_API_KEY) {
    try {
      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        {
          model: 'qwen-max',
          input: {
            messages: [
              { role: 'system', content: 'Eres un asistente de WhatsApp natural. Responde brevemente y sin frases genéricas.' },
              { role: 'user', content: testMessage }
            ]
          },
          parameters: {
            temperature: 0.8,
            max_tokens: 100,
            result_format: 'message'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const text = response.data?.output?.choices?.[0]?.message?.content || 
                   response.data?.output?.text;
      results.qwen = { success: true, response: text };
      console.log(`✅ Qwen: "${text}"`);
    } catch (error) {
      results.qwen = { success: false, error: error.response?.data || error.message };
      console.log(`❌ Qwen failed: ${JSON.stringify(error.response?.data || error.message)}`);
    }
  } else {
    results.qwen = { success: false, error: 'API key not available yet' };
    console.log(`⚠️ Qwen: API key not configured (waiting for user)`);
  }

  // Summary
  console.log('\n📊 RESULTS SUMMARY:');
  const working = Object.entries(results).filter(([_, result]) => result.success);
  console.log(`Working providers: ${working.length}/4`);
  
  working.forEach(([provider, result]) => {
    const isGeneric = result.response?.toLowerCase().includes('gracias por escribir') ||
                     result.response?.toLowerCase().includes('le saluda') ||
                     result.response?.toLowerCase().includes('departamento de');
    
    console.log(`✅ ${provider.toUpperCase()}: ${isGeneric ? 'GENERIC' : 'NATURAL'} response`);
  });

  if (working.length >= 2) {
    console.log('\n🎉 System ready for multi-provider AI responses!');
    return true;
  } else {
    console.log('\n⚠️ Need more working providers for optimal performance');
    return false;
  }
}

testAllProviders().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});