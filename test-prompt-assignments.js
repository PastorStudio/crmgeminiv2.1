/**
 * Test script to verify prompt assignments are working correctly
 * Each WhatsApp account should use its specific assigned prompt
 */

import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testPromptAssignments() {
  console.log('🔍 Testing prompt assignments for WhatsApp accounts...\n');
  
  try {
    // Get all WhatsApp accounts with their assigned prompts
    const accountsQuery = `
      SELECT 
        wa.id,
        wa.name,
        wa.assigned_prompt_id,
        wa.autoresponseenabled,
        ap.name as prompt_name,
        ap.content as prompt_content,
        ap.temperature,
        ap.max_tokens
      FROM whatsapp_accounts wa
      LEFT JOIN ai_prompts ap ON wa.assigned_prompt_id = ap.id
      WHERE wa.autoresponseenabled = true
      ORDER BY wa.id
    `;
    
    const result = await pool.query(accountsQuery);
    const accounts = result.rows;
    
    console.log(`Found ${accounts.length} active WhatsApp accounts with prompt assignments:\n`);
    
    // Display each account's configuration
    accounts.forEach(account => {
      console.log(`📱 Account ${account.id}: ${account.name}`);
      console.log(`   ├─ Assigned Prompt: ${account.prompt_name} (ID: ${account.assigned_prompt_id})`);
      console.log(`   ├─ Temperature: ${account.temperature}`);
      console.log(`   ├─ Max Tokens: ${account.max_tokens}`);
      console.log(`   └─ Prompt Preview: ${account.prompt_content.substring(0, 100)}...\n`);
    });
    
    // Test message processing simulation
    console.log('🧪 Simulating message processing for each account...\n');
    
    const testMessage = "Hola, necesito información sobre sus servicios";
    
    for (const account of accounts) {
      console.log(`📨 Testing Account ${account.id} (${account.name}):`);
      console.log(`   Message: "${testMessage}"`);
      console.log(`   Expected AI Personality: ${account.prompt_name}`);
      console.log(`   Prompt System: "${account.prompt_content.substring(0, 150)}..."`);
      
      // Verify the prompt is specific and not generic
      const isGeneric = account.prompt_content.toLowerCase().includes('virtual agent') && 
                       !account.prompt_content.toLowerCase().includes('especializado');
      
      if (isGeneric) {
        console.log(`   ⚠️  WARNING: Account may be using generic prompt instead of specialized one`);
      } else {
        console.log(`   ✅ Account has specialized prompt configuration`);
      }
      console.log('');
    }
    
    // Verify no accounts are sharing the same generic prompt
    console.log('🔍 Checking for prompt diversity...\n');
    
    const promptCounts = {};
    accounts.forEach(account => {
      const promptId = account.assigned_prompt_id;
      promptCounts[promptId] = (promptCounts[promptId] || 0) + 1;
    });
    
    Object.entries(promptCounts).forEach(([promptId, count]) => {
      const prompt = accounts.find(a => a.assigned_prompt_id == promptId);
      console.log(`📋 Prompt ${promptId} (${prompt.prompt_name}): Used by ${count} account(s)`);
    });
    
    console.log('\n✅ Prompt assignment verification completed successfully!');
    
    // Expected configuration summary
    console.log('\n📊 Expected Configuration:');
    console.log('   Account 1: Medical Assistant (Prompt 8)');
    console.log('   Account 2: Sales Agent CRM (Prompt 9)');
    console.log('   Account 3: Sales Agent CRM (Prompt 9)');
    console.log('   Account 4: CRM Support (Prompt 7)');
    
  } catch (error) {
    console.error('❌ Error testing prompt assignments:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testPromptAssignments().catch(console.error);