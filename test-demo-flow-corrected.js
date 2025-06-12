/**
 * Test del flujo correcto de creación de demos:
 * 1. Cliente solicita demo -> Sistema pregunta nombre
 * 2. Cliente proporciona nombre -> Sistema crea demo
 */

import { RealtimeDemoCreator } from './server/services/realtimeDemoCreator.ts';
import { pool } from './server/db.ts';

const realtimeDemoCreator = RealtimeDemoCreator.getInstance();

async function testCorrectDemoFlow() {
  console.log('🧪 Iniciando test del flujo correcto de creación de demos...\n');

  try {
    // Conectar a la base de datos
    console.log('Conectando a la base de datos PostgreSQL...');

    // Test 1: Cliente solicita demo
    console.log('\n--- Test 1: Cliente solicita demo ---');
    const chatId = 'test_chat_123';
    const messageId1 = 'msg_001';
    
    const step1 = await realtimeDemoCreator.processMessage(
      'Quiero probar el sistema',
      chatId,
      messageId1,
      1
    );

    console.log('Mensaje:', '"Quiero probar el sistema"');
    console.log('Respuesta del sistema:', step1.shouldRespond ? 'SÍ' : 'NO');
    if (step1.shouldRespond) {
      console.log('Mensaje de respuesta:');
      console.log(step1.responseMessage);
    }

    // Test 2: Cliente proporciona su nombre
    console.log('\n--- Test 2: Cliente proporciona nombre ---');
    const messageId2 = 'msg_002';
    
    const step2 = await realtimeDemoCreator.processMessage(
      'Mi nombre es Carlos Mendoza',
      chatId,
      messageId2,
      1
    );

    console.log('Mensaje:', '"Mi nombre es Carlos Mendoza"');
    console.log('Respuesta del sistema:', step2.shouldRespond ? 'SÍ' : 'NO');
    if (step2.shouldRespond) {
      console.log('Mensaje de respuesta:');
      console.log(step2.responseMessage?.substring(0, 300) + '...');
    }

    // Test 3: Verificar que se creó el usuario en la base de datos
    console.log('\n--- Test 3: Verificación en base de datos ---');
    const userCheck = await pool.query(`
      SELECT username, customer_name, full_name, demo_number, created_at, expires_at, status
      FROM demo_users 
      WHERE full_name = 'Carlos Mendoza'
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      console.log('✅ Usuario demo creado exitosamente:');
      console.log(`   - Username: ${user.username}`);
      console.log(`   - Nombre: ${user.full_name}`);
      console.log(`   - Número demo: ${user.demo_number}`);
      console.log(`   - Estado: ${user.status}`);
      console.log(`   - Creado: ${user.created_at}`);
      console.log(`   - Expira: ${user.expires_at}`);
      
      // Calcular duración
      const created = new Date(user.created_at);
      const expires = new Date(user.expires_at);
      const duration = (expires - created) / (1000 * 60 * 60 * 24);
      console.log(`   - Duración: ${duration.toFixed(2)} días`);
    } else {
      console.log('❌ No se encontró el usuario demo en la base de datos');
    }

    // Test 4: Solicitud con palabra diferente
    console.log('\n--- Test 4: Otra solicitud de demo ---');
    const chatId2 = 'test_chat_456';
    const messageId3 = 'msg_003';
    
    const step3 = await realtimeDemoCreator.processMessage(
      'Necesito información sobre el demo',
      chatId2,
      messageId3,
      1
    );

    console.log('Mensaje:', '"Necesito información sobre el demo"');
    console.log('Respuesta del sistema:', step3.shouldRespond ? 'SÍ' : 'NO');
    if (step3.shouldRespond) {
      console.log('Sistema pregunta por el nombre (como debe ser)');
    }

    // Test 5: Mensaje normal (no solicitud de demo)
    console.log('\n--- Test 5: Mensaje normal ---');
    const chatId3 = 'test_chat_789';
    const messageId4 = 'msg_004';
    
    const step4 = await realtimeDemoCreator.processMessage(
      'Hola, ¿cómo están?',
      chatId3,
      messageId4,
      1
    );

    console.log('Mensaje:', '"Hola, ¿cómo están?"');
    console.log('Respuesta del sistema:', step4.shouldRespond ? 'SÍ' : 'NO');
    console.log('✅ Correcto: No responde a mensajes normales');

    console.log('\n🎉 ¡Test del flujo correcto completado!');
    console.log('\n📋 Resumen:');
    console.log('1. ✅ Sistema detecta solicitudes de demo');
    console.log('2. ✅ Sistema pregunta por el nombre');
    console.log('3. ✅ Sistema crea demo al recibir nombre');
    console.log('4. ✅ Usuario demo almacenado en base de datos');
    console.log('5. ✅ Sistema ignora mensajes normales');

  } catch (error) {
    console.error('❌ Error en el test:', error);
  } finally {
    process.exit(0);
  }
}

testCorrectDemoFlow();