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

    for (const chat of chats) {
      await processChat(chat);
    }

  } catch (error) {
    console.error('❌ Error verificando nuevos mensajes:', error);
  }
}

async function processChat(chat: any) {
  try {
    // Obtener mensajes del chat
    const messagesResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/1/messages/${chat.id}`);
    if (!messagesResponse.ok) return;

    const messages = await messagesResponse.json();
    if (!messages || messages.length === 0) return;

    // Encontrar el último mensaje recibido (no enviado por nosotros)
    const lastIncomingMessage = findLastIncomingMessage(messages);
    if (!lastIncomingMessage) return;

    // Verificar si ya procesamos este mensaje
    const lastProcessedId = lastProcessedMessages.get(chat.id);
    if (lastProcessedId === lastIncomingMessage.id) {
      return; // Ya procesamos este mensaje
    }

    // Verificar que el mensaje no esté vacío
    if (!lastIncomingMessage.body || lastIncomingMessage.body.trim() === '') {
      return; // Ignorar mensajes vacíos
    }

    console.log(`📨 Nuevo mensaje encontrado en chat ${chat.name}: "${lastIncomingMessage.body}"`);

    // Generar respuesta usando agente externo (mismo código que funciona en las pruebas)
    const response = await generateResponseWithExternalAgent(lastIncomingMessage.body);
    
    if (response) {
      // Enviar la respuesta
      await sendAutoResponse(chat.id, response);
      
      // Marcar este mensaje como procesado
      lastProcessedMessages.set(chat.id, lastIncomingMessage.id);
      
      console.log(`✅ Respuesta automática enviada a ${chat.name}: "${response}"`);
    }

  } catch (error) {
    console.error(`❌ Error procesando chat ${chat.id}:`, error);
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