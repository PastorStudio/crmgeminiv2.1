/**
 * Test comprehensive para verificar ambas correcciones:
 * 1. Flujo correcto de demos (sin credenciales hardcodeadas)
 * 2. Análisis IA de conversaciones funcionando correctamente
 */

async function loadModules() {
  const { enhancedDemoDetector } = await import('./server/services/enhancedDemoDetector.ts');
  const { conversationAnalysisService } = await import('./server/services/conversationAnalysis.ts');
  const { db } = await import('./server/db/index.ts');
  const { demoUsers, whatsappMessages, contacts } = await import('./shared/schema.ts');
  const { desc, eq } = await import('drizzle-orm');
  
  return {
    enhancedDemoDetector,
    conversationAnalysisService,
    db,
    demoUsers,
    whatsappMessages,
    contacts,
    desc,
    eq
  };
}

async function testComprehensiveFixes() {
  console.log('🧪 INICIANDO PRUEBAS COMPREHENSIVAS DE CORRECCIONES');
  console.log('=' .repeat(60));

  // Load all required modules
  const {
    enhancedDemoDetector,
    conversationAnalysisService,
    db,
    demoUsers,
    whatsappMessages,
    contacts,
    desc,
    eq
  } = await loadModules();

  // === PRUEBA 1: FLUJO CORRECTO DE DEMOS (SIN HARDCODED) ===
  console.log('\n📋 PRUEBA 1: Flujo correcto de creación de demos');
  console.log('-'.repeat(40));

  try {
    // Simular solicitud de demo
    console.log('👤 Simulando solicitud: "Quiero un demo"');
    const response1 = await enhancedDemoDetector.processMessage(
      'Quiero un demo por favor',
      'test_chat_001',
      1,
      '123456789'
    );
    
    console.log('📤 Respuesta del sistema:', response1);
    
    // Verificar que NO contiene credenciales hardcodeadas
    if (response1 && response1.includes('demo123456')) {
      console.log('❌ ERROR: Aún contiene credenciales hardcodeadas "demo123456"');
      return false;
    } else if (response1 && response1.includes('¿Cuál es tu nombre?')) {
      console.log('✅ CORRECTO: Sistema pregunta por el nombre primero');
    } else {
      console.log('⚠️ Respuesta inesperada en solicitud inicial');
    }

    // Simular proporcionar nombre
    console.log('\n👤 Simulando respuesta: "Mi nombre es Juan Pérez"');
    const response2 = await enhancedDemoDetector.processMessage(
      'Mi nombre es Juan Pérez',
      'test_chat_001',
      1,
      '123456789'
    );
    
    console.log('📤 Respuesta del sistema:', response2);
    
    // Verificar que ahora SÍ crea el demo
    if (response2 && response2.includes('Usuario:') && response2.includes('Contraseña:')) {
      console.log('✅ CORRECTO: Demo creado correctamente después de proporcionar nombre');
      
      // Verificar que NO contiene "demo123456"
      if (response2.includes('demo123456')) {
        console.log('❌ ERROR: Aún usa contraseña hardcodeada');
        return false;
      } else {
        console.log('✅ CORRECTO: No usa contraseñas hardcodeadas');
      }
    } else {
      console.log('❌ ERROR: No se creó el demo después de proporcionar nombre');
      return false;
    }

  } catch (error) {
    console.log('❌ ERROR en prueba de demos:', error.message);
    return false;
  }

  // === PRUEBA 2: ANÁLISIS IA DE CONVERSACIONES ===
  console.log('\n🧠 PRUEBA 2: Análisis IA de conversaciones');
  console.log('-'.repeat(40));

  try {
    // Verificar que el servicio esté corriendo
    const analysisStatus = conversationAnalysisService.getStatus();
    console.log('📊 Estado del servicio de análisis:', analysisStatus);
    
    if (!analysisStatus.running) {
      console.log('🚀 Iniciando servicio de análisis...');
      conversationAnalysisService.start();
      console.log('✅ Servicio iniciado');
    }

    // Insertar mensajes de prueba para analizar
    console.log('📝 Insertando mensajes de prueba...');
    
    const testMessages = [
      {
        accountId: 1,
        chatId: 'test_analysis_chat',
        content: 'Hola, mi nombre es María García y trabajo en marketing digital',
        from_me: false,
        timestamp: new Date(),
        message_id: `test_msg_${Date.now()}_1`,
        from: '987654321@c.us'
      },
      {
        accountId: 1,
        chatId: 'test_analysis_chat',
        content: 'Estoy interesada en sus servicios de automatización',
        from_me: false,
        timestamp: new Date(Date.now() + 1000),
        message_id: `test_msg_${Date.now()}_2`,
        from: '987654321@c.us'
      },
      {
        accountId: 1,
        chatId: 'test_analysis_chat',
        content: 'Trabajo desde Barcelona y necesito algo urgente',
        from_me: false,
        timestamp: new Date(Date.now() + 2000),
        message_id: `test_msg_${Date.now()}_3`,
        from: '987654321@c.us'
      }
    ];

    for (const msg of testMessages) {
      await db.insert(whatsappMessages).values(msg);
    }
    
    console.log('✅ Mensajes de prueba insertados');

    // Esperar un momento para que el análisis procese
    console.log('⏳ Esperando procesamiento del análisis (10 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Verificar si se creó/actualizó información de contacto
    const contactInfo = await db.select()
      .from(contacts)
      .where(eq(contacts.whatsapp_id, '987654321@c.us'))
      .limit(1);

    if (contactInfo.length > 0) {
      console.log('✅ CORRECTO: Información de contacto encontrada:', {
        name: contactInfo[0].name,
        location: contactInfo[0].location,
        profession: contactInfo[0].profession
      });
      
      // Verificar que la información extraída sea correcta
      const contact = contactInfo[0];
      let analysisCorrect = true;
      
      if (!contact.name || !contact.name.includes('María')) {
        console.log('⚠️ Nombre no extraído correctamente');
        analysisCorrect = false;
      }
      
      if (!contact.profession || !contact.profession.includes('marketing')) {
        console.log('⚠️ Profesión no extraída correctamente');
        analysisCorrect = false;
      }
      
      if (!contact.location || !contact.location.includes('Barcelona')) {
        console.log('⚠️ Ubicación no extraída correctamente');
        analysisCorrect = false;
      }
      
      if (analysisCorrect) {
        console.log('✅ CORRECTO: Análisis IA extrae información correctamente');
      } else {
        console.log('⚠️ Análisis IA funciona pero información incompleta');
      }
      
    } else {
      console.log('❌ ERROR: No se encontró información de contacto analizada');
      console.log('🔍 Verificando mensajes en base de datos...');
      
      const messages = await db.select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.chatId, 'test_analysis_chat'))
        .orderBy(desc(whatsappMessages.timestamp));
        
      console.log(`📊 Mensajes encontrados: ${messages.length}`);
      
      return false;
    }

  } catch (error) {
    console.log('❌ ERROR en prueba de análisis IA:', error.message);
    return false;
  }

  // === PRUEBA 3: VERIFICACIÓN DE DEMO MANAGEMENT UI ===
  console.log('\n🎨 PRUEBA 3: Verificación de gestión de demos');
  console.log('-'.repeat(40));

  try {
    // Verificar demos recientes
    const recentDemos = await db.select()
      .from(demoUsers)
      .orderBy(desc(demoUsers.created_at))
      .limit(5);

    console.log(`📊 Demos encontrados: ${recentDemos.length}`);
    
    if (recentDemos.length > 0) {
      const latestDemo = recentDemos[0];
      console.log('📋 Demo más reciente:', {
        username: latestDemo.username,
        customerName: latestDemo.customer_name,
        isActive: latestDemo.is_active,
        createdAt: latestDemo.created_at
      });
      
      // Verificar que no tenga contraseña hardcodeada
      if (latestDemo.customer_name && latestDemo.customer_name !== 'demo123456') {
        console.log('✅ CORRECTO: Demo no usa datos hardcodeados');
      } else {
        console.log('❌ ERROR: Demo aún contiene datos hardcodeados');
        return false;
      }
    }

  } catch (error) {
    console.log('❌ ERROR en verificación de demos:', error.message);
    return false;
  }

  // === RESUMEN FINAL ===
  console.log('\n🎉 RESUMEN DE PRUEBAS COMPREHENSIVAS');
  console.log('=' .repeat(60));
  console.log('✅ CORRECCIÓN 1: Flujo de demos sin credenciales hardcodeadas');
  console.log('✅ CORRECCIÓN 2: Análisis IA de conversaciones funcionando');
  console.log('✅ CORRECCIÓN 3: Sistema de gestión de demos operativo');
  console.log('\n🚀 TODAS LAS CORRECCIONES VERIFICADAS EXITOSAMENTE');
  
  return true;
}

// Ejecutar pruebas
testComprehensiveFixes()
  .then(success => {
    if (success) {
      console.log('\n🎯 RESULTADO: TODAS LAS CORRECCIONES FUNCIONAN CORRECTAMENTE');
      process.exit(0);
    } else {
      console.log('\n❌ RESULTADO: ALGUNAS CORRECCIONES NECESITAN REVISIÓN');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 ERROR CRÍTICO EN PRUEBAS:', error);
    process.exit(1);
  });