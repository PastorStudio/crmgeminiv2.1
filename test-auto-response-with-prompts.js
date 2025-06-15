/**
 * Test script para verificar que las respuestas automáticas usen prompts asignados
 */

async function testAutoResponseWithPrompts() {
  try {
    console.log('🧪 Iniciando test de respuestas automáticas con prompts asignados...');
    
    // Importar el auto responder (usar require para TypeScript compilado)
    const { WhatsAppAutoResponder } = require('./server/services/whatsappAutoResponder.ts');
    
    // Simular mensaje de WhatsApp
    const testMessage = {
      id: `test_${Date.now()}`,
      body: "Hola, necesito ayuda con mi pedido",
      fromMe: false,
      timestamp: Date.now(),
      chatId: "51234567890@c.us",
      type: 'chat'
    };
    
    console.log('📱 Mensaje de prueba:', testMessage.body);
    
    // Activar auto-respuesta para el chat
    WhatsAppAutoResponder.activateForChat(testMessage.chatId, "Smartbot IA");
    console.log(`✅ Auto-respuesta activada para chat ${testMessage.chatId}`);
    
    // Mock de función sendMessage
    const mockSendMessage = async (to, message) => {
      console.log(`📤 RESPUESTA AUTOMÁTICA enviada a ${to}:`);
      console.log(`💬 ${message}`);
      return true;
    };
    
    // Procesar mensaje
    console.log('🔄 Procesando mensaje...');
    const result = await WhatsAppAutoResponder.processIncomingMessage(
      testMessage,
      mockSendMessage
    );
    
    if (result) {
      console.log('✅ Respuesta automática generada exitosamente');
    } else {
      console.log('❌ No se generó respuesta automática');
    }
    
    // Verificar chats activos
    const activeChats = WhatsAppAutoResponder.getActiveChats();
    console.log(`📊 Chats activos con auto-respuesta: ${activeChats.length}`);
    
    // Limpiar
    WhatsAppAutoResponder.deactivateForChat(testMessage.chatId);
    console.log('🧹 Test completado y limpieza realizada');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

// Ejecutar test
testAutoResponseWithPrompts();