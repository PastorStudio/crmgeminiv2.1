/**
 * Script de diagnóstico profundo para identificar problemas con 
 * la identificación de mensajes después de la conexión con GitHub
 */

import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

async function testMessageIdentification() {
  console.log('🔍 INICIANDO DIAGNÓSTICO PROFUNDO DE IDENTIFICACIÓN DE MENSAJES');
  console.log('='.repeat(80));

  try {
    // 1. Verificar estado de cuentas WhatsApp
    console.log('\n📱 VERIFICANDO ESTADO DE CUENTAS WHATSAPP...');
    const accountsResponse = await execPromise('curl -s "http://localhost:5000/api/whatsapp-accounts"');
    const accounts = JSON.parse(accountsResponse.stdout);
    
    console.log(`✅ Cuentas encontradas: ${accounts.accounts?.length || 0}`);
    
    for (const account of accounts.accounts || []) {
      console.log(`\n📋 Cuenta ${account.id} (${account.name}):`);
      console.log(`   - Estado: ${account.status}`);
      console.log(`   - Autenticada: ${account.authenticated}`);
      console.log(`   - Lista: ${account.ready}`);
      console.log(`   - currentStatus.authenticated: ${account.currentStatus?.authenticated}`);
      console.log(`   - currentStatus.ready: ${account.currentStatus?.ready}`);
      console.log(`   - Respuestas automáticas: ${account.autoResponseEnabled}`);
      console.log(`   - Prompt asignado: ${account.assignedPromptId}`);
      
      // Verificar inconsistencias de estado
      if (account.authenticated !== account.currentStatus?.authenticated) {
        console.log(`   🚨 INCONSISTENCIA: authenticated (${account.authenticated}) != currentStatus.authenticated (${account.currentStatus?.authenticated})`);
      }
      
      if (account.ready !== account.currentStatus?.ready) {
        console.log(`   🚨 INCONSISTENCIA: ready (${account.ready}) != currentStatus.ready (${account.currentStatus?.ready})`);
      }
    }

    // 2. Verificar estado de los administradores de WhatsApp
    console.log('\n🔧 VERIFICANDO ADMINISTRADORES DE WHATSAPP...');
    try {
      const managerResponse = await execPromise('curl -s "http://localhost:5000/api/whatsapp/manager-status"');
      const managerStatus = JSON.parse(managerResponse.stdout);
      console.log('✅ Estado del administrador:', JSON.stringify(managerStatus, null, 2));
    } catch (error) {
      console.log('❌ Error obteniendo estado del administrador:', error.message);
    }

    // 3. Probar procesamiento directo de mensajes
    console.log('\n🧪 PROBANDO PROCESAMIENTO DIRECTO DE MENSAJES...');
    
    const testMessage = {
      accountId: 1,
      chatId: "51234567890@c.us",
      messageText: "Hola, necesito información sobre sus servicios",
      fromMe: false
    };
    
    try {
      const directResponse = await execPromise(`curl -s -X POST "http://localhost:5000/api/test-auto-response" -H "Content-Type: application/json" -d '${JSON.stringify(testMessage)}'`);
      console.log('✅ Respuesta de procesamiento directo:', directResponse.stdout);
    } catch (error) {
      console.log('❌ Error en procesamiento directo:', error.message);
    }

    // 4. Verificar logs del sistema de respuestas automáticas
    console.log('\n📊 VERIFICANDO CONFIGURACIÓN DE RESPUESTAS AUTOMÁTICAS...');
    try {
      const configResponse = await execPromise('curl -s "http://localhost:5000/api/auto-response/status"');
      console.log('✅ Estado de respuestas automáticas:', configResponse.stdout);
    } catch (error) {
      console.log('❌ Error obteniendo configuración de respuestas automáticas:', error.message);
    }

    // 5. Verificar prompt asignado específicamente
    console.log('\n🤖 VERIFICANDO PROMPT ASIGNADO...');
    try {
      const promptResponse = await execPromise('curl -s "http://localhost:5000/api/ai-prompts/7"');
      const promptData = JSON.parse(promptResponse.stdout);
      
      if (promptData && promptData.name) {
        console.log(`✅ Prompt ID 7 encontrado: "${promptData.name}"`);
        console.log(`   Contenido: ${promptData.content?.substring(0, 100) || 'Sin contenido'}...`);
      } else {
        console.log('❌ Prompt ID 7 no encontrado o sin datos');
      }
    } catch (error) {
      console.log('❌ Error verificando prompt:', error.message);
    }

    // 6. Verificar eventos de mensajes en tiempo real
    console.log('\n⚡ VERIFICANDO SISTEMA DE EVENTOS...');
    try {
      const eventsResponse = await execPromise('curl -s "http://localhost:5000/api/events/status"');
      console.log('✅ Estado del sistema de eventos:', eventsResponse.stdout);
    } catch (error) {
      console.log('❌ Error obteniendo estado de eventos:', error.message);
    }

    // 7. Diagnóstico específico de GitHub
    console.log('\n🐙 DIAGNÓSTICO ESPECÍFICO DE CONEXIÓN GITHUB...');
    
    // Verificar si hay archivos de configuración de GitHub que puedan estar interfiriendo
    try {
      const { stdout: gitConfig } = await execPromise('ls -la .git/ 2>/dev/null || echo "No hay configuración Git"');
      console.log('Git config:', gitConfig);
      
      const { stdout: gitIgnore } = await execPromise('cat .gitignore 2>/dev/null || echo "No hay .gitignore"');
      if (gitIgnore.includes('session') || gitIgnore.includes('whatsapp')) {
        console.log('🚨 POSIBLE PROBLEMA: .gitignore puede estar afectando archivos de sesión de WhatsApp');
      }
    } catch (error) {
      console.log('Info: No se pudo verificar configuración Git');
    }

    // 8. Verificar archivos de sesión de WhatsApp
    console.log('\n💾 VERIFICANDO ARCHIVOS DE SESIÓN WHATSAPP...');
    try {
      const { stdout: sessionFiles } = await execPromise('find . -name "*.json" -path "*session*" -o -name "*whatsapp*" | head -10');
      if (sessionFiles.trim()) {
        console.log('✅ Archivos de sesión encontrados:');
        console.log(sessionFiles);
      } else {
        console.log('⚠️ No se encontraron archivos de sesión de WhatsApp');
      }
    } catch (error) {
      console.log('❌ Error verificando archivos de sesión:', error.message);
    }

    // 9. Diagnóstico de conectividad
    console.log('\n🌐 VERIFICANDO CONECTIVIDAD...');
    try {
      const healthResponse = await execPromise('curl -s "http://localhost:5000/health"');
      console.log('✅ Health check:', healthResponse.stdout);
    } catch (error) {
      console.log('❌ Error en health check:', error.message);
    }

    console.log('\n='.repeat(80));
    console.log('🏁 DIAGNÓSTICO COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

testMessageIdentification();