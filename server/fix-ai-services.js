/**
 * Direct fix for AI services - identifies and resolves credential issues
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

async function diagnoseProblem() {
  console.log('🔍 Diagnosing AI service issues...\n');
  
  const issues = [];
  const fixes = [];
  
  // Check environment variables
  if (!process.env.GEMINI_API_KEY) {
    issues.push('GEMINI_API_KEY missing');
  } else {
    console.log('✅ GEMINI_API_KEY found');
  }
  
  if (!process.env.DEEPSEEK_API_KEY) {
    issues.push('DEEPSEEK_API_KEY missing');
  } else {
    console.log('✅ DEEPSEEK_API_KEY found');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    issues.push('OPENAI_API_KEY missing');
  } else {
    console.log('✅ OPENAI_API_KEY found');
  }
  
  // Test Gemini with correct model
  try {
    console.log('\n🧪 Testing Gemini API...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent("Responde brevemente: ¿Funciona Gemini?");
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Gemini API working correctly');
    console.log('Response preview:', text.substring(0, 50) + '...');
    fixes.push('Gemini: Model updated to gemini-1.5-flash');
  } catch (error) {
    console.log('❌ Gemini failed:', error.message);
    issues.push(`Gemini error: ${error.message}`);
  }
  
  // Test DeepSeek
  try {
    console.log('\n🧪 Testing DeepSeek API...');
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: 'Responde brevemente: ¿Funciona DeepSeek?' }
      ],
      max_tokens: 100
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ DeepSeek API working correctly');
    console.log('Response preview:', response.data.choices[0].message.content.substring(0, 50) + '...');
  } catch (error) {
    console.log('❌ DeepSeek failed:', error.response?.data?.error || error.message);
    issues.push(`DeepSeek error: ${error.response?.data?.error || error.message}`);
  }
  
  // Test OpenAI
  try {
    console.log('\n🧪 Testing OpenAI API...');
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Responde brevemente: ¿Funciona OpenAI?' }
      ],
      max_tokens: 100
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ OpenAI API working correctly');
    console.log('Response preview:', response.data.choices[0].message.content.substring(0, 50) + '...');
  } catch (error) {
    console.log('❌ OpenAI failed:', error.response?.data?.error || error.message);
    issues.push(`OpenAI error: ${error.response?.data?.error || error.message}`);
  }
  
  // Summary
  console.log('\n📊 DIAGNOSIS SUMMARY:');
  if (issues.length === 0) {
    console.log('✅ All AI services are properly configured');
  } else {
    console.log('❌ Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  if (fixes.length > 0) {
    console.log('\n🔧 Fixes applied:');
    fixes.forEach(fix => console.log(`  - ${fix}`));
  }
  
  return { issues, fixes };
}

// Run diagnosis
diagnoseProblem().catch(console.error);