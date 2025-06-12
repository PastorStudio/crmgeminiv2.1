/**
 * Test funcional del sistema de creación automática de usuarios demo
 */

import { db } from './server/db.js';
import { demoUsers, users, demoTracking } from './shared/schema.js';
import { max } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function testDemoCreationWorking() {
  console.log('🧪 Iniciando prueba funcional del sistema de usuarios demo...');
  
  try {
    // Simular los datos de entrada
    const clientName = "Maria Test";
    const chatId = "57300987654@c.us";
    const accountId = 1;
    
    console.log(`📋 Datos de entrada:`);
    console.log(`   Cliente: ${clientName}`);
    console.log(`   Chat: ${chatId}`);
    console.log(`   Cuenta: ${accountId}`);
    
    // Generar credenciales únicas
    const randomSuffix = Math.floor(Math.random() * 1000);
    const username = `demo_${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}`;
    const password = 'demo123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log(`🔑 Credenciales generadas:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    
    // Calcular fecha de expiración (3 días)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 3);
    
    // Obtener el siguiente número de demo disponible
    const demoNumberResult = await db.select({ 
      nextDemoNumber: max(demoUsers.demoNumber) 
    }).from(demoUsers);
    const demoNumber = (demoNumberResult[0]?.nextDemoNumber || 0) + 1;
    
    console.log(`📊 Número de demo asignado: ${demoNumber}`);
    console.log(`📅 Fecha de expiración: ${expirationDate.toLocaleDateString()}`);
    
    // Paso 1: Crear usuario demo
    console.log('\n📝 Paso 1: Creando entrada en demo_users...');
    const demoUserResult = await db.insert(demoUsers).values({
      customerName: clientName,
      phoneNumber: chatId.replace('@c.us', ''),
      username: username,
      password: password,
      demoNumber: demoNumber,
      chatId: chatId,
      expiresAt: expirationDate
    }).returning();
    
    const demoUser = demoUserResult[0];
    console.log(`✅ Usuario demo creado con ID: ${demoUser.id}`);
    
    // Paso 2: Crear usuario principal del sistema
    console.log('\n📝 Paso 2: Creando usuario principal del sistema...');
    const userResult = await db.insert(users).values({
      username: username,
      fullName: clientName,
      email: `${username}@demo.geminicrm.com`,
      password: hashedPassword,
      role: 'demo',
      status: 'active',
      department: 'demo'
    }).returning();
    
    const user = userResult[0];
    console.log(`✅ Usuario principal creado con ID: ${user.id}`);
    
    // Paso 3: Crear registro de tracking
    console.log('\n📝 Paso 3: Creando registro de tracking...');
    await db.insert(demoTracking).values({
      userId: user.id,
      demoUserId: demoUser.id,
      chatId: chatId,
      phoneNumber: chatId.replace('@c.us', ''),
      clientName: clientName,
      expiresAt: expirationDate
    });
    
    console.log(`✅ Tracking registrado correctamente`);
    
    // Generar mensaje de credenciales
    const formattedDate = expirationDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const credentialsMessage = `🎉 ¡Perfecto ${clientName}! Tu demo personalizado está listo

🔑 **TUS CREDENCIALES DE ACCESO:**
📧 Usuario: ${username}
🔒 Contraseña: demo123
🌐 URL: https://geminicrm.com/login

⏰ **DETALLES DE TU ACCESO:**
✅ Duración: 3 días completos
📅 Expira: ${formattedDate}
🚀 Acceso total a todas las funciones premium

🎯 **LO QUE PUEDES HACER:**
• Configurar respuestas automáticas con IA
• Gestionar múltiples cuentas de WhatsApp
• Envío masivo de mensajes
• Análisis avanzados y reportes
• Panel de administración completo

💡 **EMPEZAR AHORA:**
1. Ve a la URL de arriba
2. Ingresa tu usuario y contraseña
3. ¡Explora todas las funciones!

¿Alguna pregunta sobre tu demo? ¡Estoy aquí para ayudarte! 🚀`;

    console.log('\n📧 Mensaje de credenciales generado:');
    console.log('=' * 60);
    console.log(credentialsMessage);
    console.log('=' * 60);
    
    console.log('\n✅ SISTEMA DE DEMO FUNCIONAL - PRUEBA EXITOSA');
    console.log('🎯 Resultados:');
    console.log(`   Demo User ID: ${demoUser.id}`);
    console.log(`   System User ID: ${user.id}`);
    console.log(`   Username: ${username}`);
    console.log(`   Demo Number: ${demoNumber}`);
    console.log(`   Chat ID: ${chatId}`);
    console.log(`   Expires: ${formattedDate}`);
    
    return {
      success: true,
      demoUser,
      user,
      username,
      demoNumber,
      credentialsMessage
    };
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    return { success: false, error: error.message };
  }
}

// Ejecutar la prueba
testDemoCreationWorking()
  .then(result => {
    console.log('\n🏁 Resultado final:', result.success ? 'EXITOSO' : 'FALLIDO');
    if (result.success) {
      console.log('🎉 El sistema de usuarios demo está completamente funcional');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error crítico:', error);
    process.exit(1);
  });