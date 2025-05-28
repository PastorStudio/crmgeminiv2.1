/**
 * Utilidad para comunicarse con agentes externos reales
 * Conecta directamente con los agentes configurados en el sistema
 */

export async function generateExternalAgentResponse(messageText: string, agentId: string): Promise<string | null> {
  try {
    console.log(`🤖 Conectando con agente externo REAL ID: ${agentId}`);
    console.log(`💬 Mensaje a enviar: "${messageText}"`);
    
    // Llamar al endpoint que conecta con el agente externo real
    const response = await fetch('/api/ai/chat-with-external-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: messageText,
        agentId: agentId
      })
    });

    if (!response.ok) {
      console.error('❌ Error en respuesta del agente externo:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.response) {
      console.log('✅ Respuesta REAL del agente externo:', data.response);
      return data.response.trim();
    } else {
      console.error('❌ El agente externo no devolvió una respuesta válida:', data);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error conectando con agente externo:', error);
    return null;
  }
}

/**
 * Extrae el último mensaje recibido (no enviado por nosotros)
 */
export function getLastReceivedMessage(messages: any[]): string | null {
  if (!messages || !Array.isArray(messages)) {
    return null;
  }

  // Buscar el último mensaje que no es nuestro (fromMe = false)
  const lastReceived = messages
    .filter((msg: any) => !msg.fromMe && msg.body && msg.body.trim().length > 0)
    .sort((a: any, b: any) => b.timestamp - a.timestamp)[0];

  return lastReceived?.body || null;
}

/**
 * Variables globales para control de auto-clic inteligente
 */
let lastProcessedTimestamp = '';
let lastProcessedMessage = '';

/**
 * Función de auto-clic inteligente con validación de timestamp y mensaje
 */
export function startAutoClickFunction(accountId: number): () => void {
  console.log('🚀 AUTO-CLIC INTELIGENTE ACTIVADO - Sistema de doble validación iniciado');
  
  const intervalId = setInterval(async () => {
    try {
      // 1. OBTENER TIMESTAMP ACTUAL (hora:minuto:segundo)
      const now = new Date();
      const currentTimestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      // 2. OBTENER ÚLTIMO MENSAJE RECIBIDO
      const messagesArea = document.querySelector('.messages-container') || 
                          document.querySelector('[data-testid="conversation-panel"]') ||
                          document.querySelector('.message-list');
      
      let currentMessage = '';
      if (messagesArea) {
        const incomingMessages = messagesArea.querySelectorAll('.message-in, [data-testid="msg-container"]:not(.message-out), .incoming-message');
        if (incomingMessages.length > 0) {
          const lastIncoming = incomingMessages[incomingMessages.length - 1];
          currentMessage = lastIncoming.textContent?.trim() || '';
        }
      }
      
      console.log(`🕐 Timestamp: ${currentTimestamp} (Anterior: ${lastProcessedTimestamp})`);
      console.log(`💬 Mensaje: "${currentMessage.substring(0, 30)}..." (Anterior: "${lastProcessedMessage.substring(0, 30)}...")`);
      
      // 3. VALIDACIÓN 1: ¿Es diferente el timestamp (hora:minuto:segundo)?
      const timestampChanged = currentTimestamp !== lastProcessedTimestamp;
      
      // 4. VALIDACIÓN 2: ¿Es diferente el mensaje?
      const messageChanged = currentMessage !== lastProcessedMessage && currentMessage.length > 0;
      
      console.log(`✅ Validación 1 (Timestamp diferente): ${timestampChanged}`);
      console.log(`✅ Validación 2 (Mensaje diferente): ${messageChanged}`);
      
      // 5. SOLO EJECUTAR SI AMBAS VALIDACIONES SON VERDADERAS
      if (timestampChanged && messageChanged) {
        console.log('🎯 ¡CONDICIONES CUMPLIDAS! Ejecutando auto-clic...');
        
        // Actualizar registros antes del procesamiento
        lastProcessedTimestamp = currentTimestamp;
        lastProcessedMessage = currentMessage;
        
        // Buscar botón A.E
        const allButtons = document.querySelectorAll('button');
        const aeButtons = Array.from(allButtons).filter(btn => 
          btn.textContent?.includes('🤖 A.E') || 
          btn.textContent?.includes('A.E')
        );
        
        console.log(`🔍 Botones A.E encontrados: ${aeButtons.length}`);
        
        if (aeButtons.length > 0) {
          // CLIC 1: Botón A.E
          console.log('🔴 CLIC 1: Presionando botón A.E...');
          aeButtons[0].click();
          
          // Esperar 3 segundos para que se genere la respuesta
          setTimeout(() => {
            // CLIC 2: Botón Enviar
            console.log('⏱️ Buscando botón Enviar...');
            const sendButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
              btn.textContent?.includes('Enviar') ||
              btn.textContent?.includes('Send') ||
              btn.getAttribute('type') === 'submit'
            );
            
            console.log(`📤 Botones Enviar encontrados: ${sendButtons.length}`);
            
            if (sendButtons.length > 0) {
              console.log('🔴 CLIC 2: Presionando botón Enviar...');
              sendButtons[0].click();
              console.log('✅ SECUENCIA COMPLETADA: A.E → Enviar');
            } else {
              console.log('❌ No se encontró botón Enviar');
            }
          }, 3000); // 3 segundos de espera entre clics
          
        } else {
          console.log('❌ No se encontró botón A.E');
        }
      } else {
        console.log(`⏸️ CONDICIONES NO CUMPLIDAS - Esperando cambios...`);
        if (!timestampChanged) console.log('⏸️ Razón: Mismo timestamp');
        if (!messageChanged) console.log('⏸️ Razón: Mismo mensaje o mensaje vacío');
      }
      
    } catch (error) {
      console.error('❌ Error en auto-clic inteligente:', error);
    }
    
  }, 2000); // Verificar cada 2 segundos
  
  // Retornar función para detener el auto-clic
  return () => {
    console.log('🔴 AUTO-CLIC INTELIGENTE DESACTIVADO');
    clearInterval(intervalId);
    // Limpiar variables de control
    lastProcessedTimestamp = '';
    lastProcessedMessage = '';
  };
}