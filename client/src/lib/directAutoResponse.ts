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
 * Función de auto-clic que simula presionar A.E y Enviar automáticamente
 */
export function startAutoClickFunction(accountId: number): () => void {
  console.log('🚀 AUTO-CLIC DIRECTO ACTIVADO - INICIO');
  
  const intervalId = setInterval(async () => {
    console.log('⏰ Timer ejecutándose cada 4 segundos...');
    
    try {
      // Buscar todos los botones en la página
      const allButtons = document.querySelectorAll('button');
      console.log(`🔍 Total botones encontrados: ${allButtons.length}`);
      
      // Filtrar botones que contengan A.E
      const aeButtons = Array.from(allButtons).filter(btn => 
        btn.textContent?.includes('🤖 A.E') || 
        btn.textContent?.includes('A.E')
      );
      
      console.log(`🎯 Botones A.E encontrados: ${aeButtons.length}`);
      
      if (aeButtons.length > 0) {
        console.log('🔥 ¡ENCONTRADO BOTÓN A.E! - Haciendo clic...');
        
        // Hacer clic en el primer botón A.E encontrado
        aeButtons[0].click();
        
        // Esperar un momento y buscar el botón de Enviar
        setTimeout(() => {
          const sendButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
            btn.textContent?.includes('Enviar') ||
            btn.textContent?.includes('Send') ||
            btn.getAttribute('type') === 'submit'
          );
          
          console.log(`📤 Botones Enviar encontrados: ${sendButtons.length}`);
          
          if (sendButtons.length > 0) {
            console.log('🚀 ¡ENVIANDO MENSAJE! - Haciendo clic en Enviar...');
            sendButtons[0].click();
          } else {
            console.log('❌ No se encontró botón Enviar');
          }
        }, 1000); // Esperar 1 segundo entre A.E y Enviar
        
      } else {
        console.log('🔍 No se encontró botón A.E en esta iteración');
      }
      
    } catch (error) {
      console.error('❌ Error en auto-clic:', error);
    }
    
  }, 4000); // Ejecutar cada 4 segundos
  
  // Retornar función para detener el timer
  return () => {
    console.log('⏹️ AUTO-CLIC DESACTIVADO');
    clearInterval(intervalId);
  };
}