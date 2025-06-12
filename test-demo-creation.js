/**
 * Script de prueba para la funcionalidad de creación automática de usuarios demo
 */

import { DatabaseAdapter } from './server/databaseAdapter.js';

async function testDemoCreation() {
  console.log('🧪 Iniciando prueba de creación automática de usuario demo...');
  
  try {
    const db = new DatabaseAdapter();
    
    // Simular la detección del mensaje específico
    const response = "Perfecto Stephanie! 🎉\n\nEstoy creando tu demo personalizado ahora mismo...\n\nTu acceso incluirá:\n🔑 Usuario único y contraseña estándar\n⏰ Acceso completo por 3 días\n🚀 Todas las funciones premium\n📊 Panel de administración completo\n\nEn unos segundos te envío tus credenciales de acceso.";
    const chatId = "57300123456@c.us";
    const clientName = "Stephanie";
    
    // Verificar si contiene las palabras clave
    const demoKeywords = [
      "Perfecto Stephanie! 🎉",
      "Estoy creando tu demo personalizado",
      "Tu acceso incluirá:",
      "Usuario único y contraseña estándar",
      "Acceso completo por 3 días"
    ];

    const containsDemoMessage = demoKeywords.some(keyword => 
      response.includes(keyword)
    );

    console.log(`✅ Mensaje detectado como creación de demo: ${containsDemoMessage}`);
    
    if (containsDemoMessage) {
      console.log(`🎯 Detectado mensaje de creación de demo para chat: ${chatId}`);
      
      // Generar credenciales únicas
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      const username = `demo_${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}`;
      const password = 'demo123';
      
      // Calcular fecha de expiración (3 días)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 3);
      
      console.log(`📝 Generando usuario: ${username}`);
      console.log(`🔒 Contraseña: ${password}`);
      console.log(`📅 Expira: ${expirationDate.toLocaleDateString()}`);
      
      // Obtener el siguiente número de demo disponible
      const demoNumberResult = await db.pool.query(`
        SELECT COALESCE(MAX(demo_number), 0) + 1 as next_demo_number FROM demo_users
      `);
      const demoNumber = demoNumberResult.rows[0].next_demo_number;
      
      // Crear el usuario demo en la tabla demo_users
      const demoUserResult = await db.pool.query(`
        INSERT INTO demo_users (customer_name, phone_number, username, password, demo_number, chat_id, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, customer_name, username, demo_number, expires_at
      `, [
        clientName,
        chatId.replace('@c.us', '').replace('@g.us', ''),
        username,
        password,
        demoNumber,
        chatId,
        expirationDate
      ]);

      if (demoUserResult.rows.length > 0) {
        const demoUser = demoUserResult.rows[0];
        console.log(`✅ Usuario demo creado en demo_users:`, demoUser);
        
        // También crear un usuario regular para el sistema con permisos demo
        const userResult = await db.pool.query(`
          INSERT INTO users (username, "fullName", email, password, role, status, department)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, username, "fullName", email, role
        `, [
          username,
          clientName,
          `${username}@demo.geminicrm.com`,
          password,
          'demo',
          'active',
          'demo'
        ]);

        const user = userResult.rows[0];
        console.log(`✅ Usuario creado en users:`, user);
        
        // Registrar en demo_tracking la asociación
        await db.pool.query(`
          INSERT INTO demo_tracking (user_id, demo_user_id, chat_id, phone_number, client_name, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          user.id,
          demoUser.id,
          chatId,
          chatId.replace('@c.us', '').replace('@g.us', ''),
          clientName,
          expirationDate
        ]);
        
        console.log(`✅ Tracking registrado en demo_tracking`);
        
        // Construir mensaje de credenciales
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
        
        // Simular envío del mensaje
        console.log(`📤 Simulando envío del mensaje de credenciales a ${chatId}`);
        
        console.log('\n✅ PRUEBA COMPLETADA EXITOSAMENTE');
        console.log(`👤 Usuario demo creado: ${username}`);
        console.log(`🔢 Número de demo: ${demoNumber}`);
        console.log(`📱 Chat asociado: ${chatId}`);
        
        return {
          success: true,
          username,
          demoNumber,
          chatId,
          credentialsMessage
        };
      }
    }
    
    return { success: false, message: 'No se detectó mensaje de demo' };
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    return { success: false, error: error.message };
  }
}

// Ejecutar la prueba
testDemoCreation()
  .then(result => {
    console.log('\n🏁 Resultado final:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error ejecutando prueba:', error);
    process.exit(1);
  });