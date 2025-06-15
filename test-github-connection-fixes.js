/**
 * Test comprensivo para verificar que los sistemas funcionan correctamente
 * después de la conexión con GitHub
 */

import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

async function testSystemAfterGitHub() {
  console.log('🔧 VERIFICANDO SISTEMA DESPUÉS DE CONEXIÓN GITHUB');
  console.log('='.repeat(60));

  // 1. Verificar estado de auto-respuestas
  console.log('\n🤖 PROBANDO SISTEMA DE AUTO-RESPUESTAS...');
  try {
    const response = await execPromise(`curl -s -X POST "http://localhost:5000/api/test-auto-response" -H "Content-Type: application/json" -d '{"accountId": 1, "chatId": "test@c.us", "messageText": "Hola, necesito información"}'`);
    
    if (response.stdout.includes('success')) {
      console.log('✅ Sistema de auto-respuestas funcional');
    } else {
      console.log('❌ Sistema de auto-respuestas con problemas');
      console.log('Respuesta:', response.stdout);
    }
  } catch (error) {
    console.log('❌ Error en auto-respuestas:', error.message);
  }

  // 2. Verificar prompts asignados
  console.log('\n🎯 VERIFICANDO PROMPTS ASIGNADOS...');
  try {
    const accountResponse = await execPromise('curl -s "http://localhost:5000/api/whatsapp-accounts/1"');
    const account = JSON.parse(accountResponse.stdout);
    
    if (account.assignedPromptId) {
      console.log(`✅ Cuenta 1 tiene prompt asignado: ${account.assignedPromptId}`);
      
      // Verificar que el prompt existe
      const promptResponse = await execPromise(`curl -s "http://localhost:5000/api/ai-prompts/${account.assignedPromptId}"`);
      const prompt = JSON.parse(promptResponse.stdout);
      
      if (prompt && prompt.name) {
        console.log(`✅ Prompt "${prompt.name}" existe y es válido`);
      } else {
        console.log('❌ Prompt asignado no encontrado');
      }
    } else {
      console.log('❌ Cuenta sin prompt asignado');
    }
  } catch (error) {
    console.log('❌ Error verificando prompts:', error.message);
  }

  // 3. Probar procesamiento de mensajes
  console.log('\n📨 PROBANDO PROCESAMIENTO DE MENSAJES...');
  try {
    const testMessages = [
      'Hola, necesito información sobre sus servicios',
      'Quiero comprar un producto',
      '¿Cuáles son sus precios?'
    ];

    for (const msg of testMessages) {
      console.log(`\n   Probando: "${msg}"`);
      
      const msgResponse = await execPromise(`curl -s -X POST "http://localhost:5000/api/test-auto-response" -H "Content-Type: application/json" -d '{"accountId": 1, "chatId": "test@c.us", "messageText": "${msg}"}'`);
      
      if (msgResponse.stdout.includes('success')) {
        console.log('   ✅ Mensaje procesado correctamente');
      } else {
        console.log('   ❌ Error procesando mensaje');
      }
    }
  } catch (error) {
    console.log('❌ Error en procesamiento de mensajes:', error.message);
  }

  // 4. Verificar estado de cuentas WhatsApp
  console.log('\n📱 VERIFICANDO ESTADO DE CUENTAS WHATSAPP...');
  try {
    const accountsResponse = await execPromise('curl -s "http://localhost:5000/api/whatsapp-accounts"');
    const accounts = JSON.parse(accountsResponse.stdout);
    
    for (const account of accounts.accounts || []) {
      console.log(`\n   Cuenta ${account.id} (${account.name}):`);
      console.log(`   - Auto-respuestas: ${account.autoResponseEnabled ? '✅ ACTIVAS' : '❌ INACTIVAS'}`);
      console.log(`   - Prompt asignado: ${account.assignedPromptId || 'Ninguno'}`);
      console.log(`   - Estado: ${account.status}`);
      
      // Verificar consistencia de estado
      const directAuth = account.authenticated;
      const statusAuth = account.currentStatus?.authenticated;
      
      if (directAuth === statusAuth) {
        console.log(`   - Estado consistente: ${directAuth ? '✅ Autenticado' : '⚠️ No autenticado'}`);
      } else {
        console.log(`   - ⚠️ INCONSISTENCIA: direct=${directAuth}, status=${statusAuth}`);
      }
    }
  } catch (error) {
    console.log('❌ Error verificando cuentas:', error.message);
  }

  // 5. Verificar conectividad general
  console.log('\n🌐 VERIFICANDO CONECTIVIDAD...');
  try {
    const healthResponse = await execPromise('curl -s "http://localhost:5000/health"');
    console.log(`✅ Servidor funcionando: ${healthResponse.stdout}`);
  } catch (error) {
    console.log('❌ Error de conectividad:', error.message);
  }

  console.log('\n='.repeat(60));
  console.log('🏁 VERIFICACIÓN COMPLETADA');
}

testSystemAfterGitHub();