/**
 * Sistema simple de respuestas automáticas
 * Usa exactamente el mismo código que funciona en las pruebas
 */

let isMonitoring = false;
let monitorInterval: NodeJS.Timeout | null = null;
let lastProcessedMessages = new Map<string, string>(); // chatId -> lastMessageId

export function startSimpleAutoResponse() {
  if (isMonitoring) {
    console.log('✅ Sistema de respuestas automáticas ya está activo');
    return;
  }

  console.log('🚀 Iniciando sistema simple de respuestas automáticas...');
  isMonitoring = true;

  // Verificar nuevos mensajes cada 15 segundos
  monitorInterval = setInterval(async () => {
    await checkAndRespondToNewMessages();
  }, 15000);

  console.log('✅ Sistema de respuestas automáticas iniciado - revisando cada 15 segundos');
}

export function stopSimpleAutoResponse() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isMonitoring = false;
  console.log('⏹️ Sistema de respuestas automáticas detenido');
}

async function checkAndRespondToNewMessages() {
  try {
    console.log('🔍 Verificando nuevos mensajes para respuesta automática...');

    // Obtener chats de la cuenta principal (ID: 1)
    const chatsResponse = await fetch('http://localhost:5000/api/whatsapp-accounts/1/chats');
    if (!chatsResponse.ok) {
      console.log('❌ No se pudieron obtener los chats');
      return;
    }

    const chats = await chatsResponse.json();
    console.log(`📋 Verificando ${chats.length} chats para nuevos mensajes...`);

    let processedChats = 0;
    let newMessagesFound = 0;

    for (const chat of chats) {
      const result = await processChat(chat);
      processedChats++;
      if (result === true) {
        newMessagesFound++;
      }
    }

    console.log(`✅ Procesados ${processedChats} chats, ${newMessagesFound} con mensajes nuevos`);

  } catch (error) {
    console.error('❌ Error verificando nuevos mensajes:', error);
  }
}

async function processChat(chat: any): Promise<boolean> {
  try {
    // Obtener mensajes del chat
    const messagesResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/1/messages/${chat.id}`);
    if (!messagesResponse.ok) {
      console.log(`⚠️ No se pudieron obtener mensajes para chat ${chat.name}`);
      return false;
    }

    const messages = await messagesResponse.json();
    if (!messages || messages.length === 0) {
      console.log(`📭 Sin mensajes en chat ${chat.name}`);
      return false;
    }

    // Encontrar el último mensaje recibido (no enviado por nosotros)
    const lastIncomingMessage = findLastIncomingMessage(messages);
    if (!lastIncomingMessage) {
      console.log(`🤖 Sin mensajes entrantes en chat ${chat.name}`);
      return false;
    }

    // Verificar si ya procesamos este mensaje
    const lastProcessedId = lastProcessedMessages.get(chat.id);
    if (lastProcessedId === lastIncomingMessage.id) {
      console.log(`✓ Mensaje ya procesado en chat ${chat.name}`);
      return false; // Ya procesamos este mensaje
    }

    // Verificar que el mensaje no esté vacío
    if (!lastIncomingMessage.body || lastIncomingMessage.body.trim() === '') {
      console.log(`📝 Mensaje vacío ignorado en chat ${chat.name}`);
      return false; // Ignorar mensajes vacíos
    }

    console.log(`📨 NUEVO MENSAJE DETECTADO en chat ${chat.name}: "${lastIncomingMessage.body}"`);
    console.log(`🆔 ID del mensaje: ${lastIncomingMessage.id}`);

    // Generar respuesta usando agente externo (mismo código que funciona en las pruebas)
    const response = await generateResponseWithExternalAgent(lastIncomingMessage.body);
    
    if (response) {
      // Enviar la respuesta
      const sent = await sendAutoResponse(chat.id, response);
      
      if (sent) {
        // Marcar este mensaje como procesado
        lastProcessedMessages.set(chat.id, lastIncomingMessage.id);
        
        console.log(`✅ RESPUESTA AUTOMÁTICA ENVIADA a ${chat.name}: "${response}"`);
        return true;
      } else {
        console.log(`❌ No se pudo enviar respuesta a ${chat.name}`);
        return false;
      }
    } else {
      console.log(`❌ No se pudo generar respuesta para chat ${chat.name}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error procesando chat ${chat.id}:`, error);
    return false;
  }
}

function findLastIncomingMessage(messages: any[]) {
  // Buscar el último mensaje que NO fue enviado por nosotros (fromMe: false)
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].fromMe) {
      return messages[i];
    }
  }
  return null;
}

async function generateResponseWithExternalAgent(messageText: string): Promise<string | null> {
  try {
    // Usar exactamente el mismo código que funciona en las pruebas
    const response = await fetch('http://localhost:5000/api/external-agents/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageText,
        chatId: 'auto-response',
        accountId: 1,
        agentId: 'test-agent-123' // Usar el agente que sabemos que funciona
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.response) {
        return result.response;
      }
    }

    console.log('❌ No se pudo generar respuesta con agente externo');
    return null;

  } catch (error) {
    console.error('❌ Error generando respuesta:', error);
    return null;
  }
}

async function sendAutoResponse(chatId: string, message: string) {
  try {
    const response = await fetch('http://localhost:5000/api/whatsapp-accounts/1/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: chatId,
        message: message
      })
    });

    if (!response.ok) {
      throw new Error(`Error enviando mensaje: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Error enviando respuesta automática:', error);
    return false;
  }
}