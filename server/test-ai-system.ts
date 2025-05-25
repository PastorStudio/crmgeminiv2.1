/**
 * Script de diagnóstico para probar el sistema AI ON/OFF
 */
import { db } from './db';
import { whatsappAccounts, externalAgents } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testAISystem() {
  console.log('🔍 DIAGNÓSTICO DEL SISTEMA AI ON/OFF');
  console.log('================================');

  try {
    // 1. Verificar configuración de cuentas
    console.log('\n1. CONFIGURACIÓN DE CUENTAS:');
    const accounts = await db.select().from(whatsappAccounts);
    
    for (const account of accounts) {
      console.log(`\nCuenta ${account.id} (${account.name}):`);
      console.log(`  - AI Habilitado: ${account.autoResponseEnabled ? '✅ SÍ' : '❌ NO'}`);
      console.log(`  - Agente Asignado: ${account.assignedExternalAgentId || 'Ninguno'}`);
      
      if (account.assignedExternalAgentId) {
        const [agent] = await db
          .select()
          .from(externalAgents)
          .where(eq(externalAgents.id, account.assignedExternalAgentId));
        
        if (agent) {
          console.log(`  - Nombre del Agente: ${agent.name}`);
          console.log(`  - Agente Activo: ${agent.isActive ? '✅ SÍ' : '❌ NO'}`);
        } else {
          console.log(`  - ⚠️  Agente no encontrado en base de datos`);
        }
      }
    }

    // 2. Verificar agentes disponibles
    console.log('\n2. AGENTES EXTERNOS DISPONIBLES:');
    const agents = await db.select().from(externalAgents);
    agents.forEach(agent => {
      console.log(`  - ${agent.name} (ID: ${agent.id})`);
      console.log(`    Activo: ${agent.isActive ? '✅ SÍ' : '❌ NO'}`);
      console.log(`    URL: ${agent.agentUrl}`);
    });

    // 3. Simular procesamiento de mensaje
    console.log('\n3. SIMULACIÓN DE PROCESAMIENTO:');
    const { autoMessageProcessor } = await import('./services/autoMessageProcessor');
    
    const testMessage = {
      id: 'test-message-123',
      body: 'Hola, necesito ayuda',
      fromMe: false,
      timestamp: Date.now(),
      chatId: '13479611717@c.us',
      accountId: 2, // Cuenta "Prueba" que tiene AI activado
      contactName: 'Cliente de Prueba',
      contactPhone: '13479611717'
    };

    console.log(`\nProcesando mensaje de prueba en cuenta ${testMessage.accountId}:`);
    console.log(`Mensaje: "${testMessage.body}"`);
    
    await autoMessageProcessor.processIncomingMessage(testMessage);

  } catch (error) {
    console.error('❌ Error en el diagnóstico:', error);
  }
}

// Ejecutar diagnóstico
testAISystem().then(() => {
  console.log('\n✅ Diagnóstico completado');
}).catch(error => {
  console.error('❌ Error ejecutando diagnóstico:', error);
});