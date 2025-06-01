/**
 * Monitor de auto-respuestas para mensajes entrantes
 */

interface MessageTracker {
  chatId: string;
  lastMessageId: string;
  lastProcessed: number;
}

class AutoResponseMonitor {
  private messageTrackers = new Map<string, MessageTracker>();
  private isMonitoring = false;
  
  async startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    
    console.log('🔄 Iniciando monitoreo de auto-respuestas...');
    
    setInterval(async () => {
      await this.checkForNewMessages();
    }, 3000); // Verificar cada 3 segundos
  }
  
  async checkForNewMessages() {
    try {
      // Usar la API existente del servidor para obtener chats
      const response = await fetch('http://localhost:5173/api/whatsapp-accounts/1/chats');
      if (!response.ok) return;
      
      const chats = await response.json();
      
      for (const chat of chats) {
        await this.processChat(chat.id);
      }
    } catch (error) {
      // Error silencioso para no saturar logs
    }
  }
  
  async processChat(chatId: string) {
    try {
      // Obtener mensajes del chat usando la API existente
      const messagesResponse = await fetch(`http://localhost:5173/api/whatsapp-accounts/1/messages/${chatId}`);
      if (!messagesResponse.ok) return;
      
      const messages = await messagesResponse.json();
      if (messages.length === 0) return;
      
      const latestMessage = messages[0];
      const tracker = this.messageTrackers.get(chatId);
      
      // Verificar si es un mensaje nuevo y no enviado por nosotros
      if (!latestMessage.fromMe && 
          (!tracker || tracker.lastMessageId !== latestMessage.id)) {
        
        console.log(`🆕 Nuevo mensaje detectado en ${chatId}: ${latestMessage.body?.substring(0, 50)}...`);
        
        // Verificar si tiene auto-respuesta habilitada
        const hasAutoResponse = await this.checkAutoResponseEnabled(chatId);
        
        if (hasAutoResponse) {
          await this.generateAndSendResponse(chatId, latestMessage);
        }
        
        // Actualizar tracker
        this.messageTrackers.set(chatId, {
          chatId,
          lastMessageId: latestMessage.id,
          lastProcessed: Date.now()
        });
      }
    } catch (error) {
      // Error silencioso
    }
  }
  
  async checkAutoResponseEnabled(chatId: string): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:5173/api/whatsapp-accounts/1/agent-config');
      if (!response.ok) return false;
      
      const config = await response.json();
      return config.assignedExternalAgentId && config.autoResponseEnabled;
    } catch {
      return false;
    }
  }
  
  async generateAndSendResponse(chatId: string, message: any) {
    try {
      console.log(`🤖 Generando respuesta automática para ${chatId}...`);
      
      // Obtener configuración del agente
      const configResponse = await fetch('http://localhost:5173/api/whatsapp-accounts/1/agent-config');
      if (!configResponse.ok) return;
      
      const config = await configResponse.json();
      if (!config.assignedExternalAgentId) return;
      
      // Generar respuesta
      const responseResult = await fetch(`http://localhost:5173/api/external-agents/${config.assignedExternalAgentId}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.body,
          chatId: chatId,
          accountId: 1
        })
      });
      
      if (!responseResult.ok) return;
      
      const responseData = await responseResult.json();
      
      if (responseData.success && responseData.response) {
        console.log(`✅ Respuesta generada: ${responseData.response.substring(0, 50)}...`);
        
        // Enviar respuesta después de 2 segundos
        setTimeout(async () => {
          try {
            let finalResponse = responseData.response;
            
            // Verificar si el sistema de traducción está activo
            try {
              const translateConfigResponse = await fetch('http://localhost:5173/api/auto-response/config');
              if (translateConfigResponse.ok) {
                const translateConfig = await translateConfigResponse.json();
                
                // Si la traducción está habilitada y hay un idioma objetivo configurado
                if (translateConfig.translateEnabled && translateConfig.targetLanguage && translateConfig.targetLanguage !== 'es') {
                  console.log(`🌐 Traduciendo respuesta de español a ${translateConfig.targetLanguage}`);
                  
                  const translatedResponse = await this.translateText(finalResponse, 'es', translateConfig.targetLanguage);
                  if (translatedResponse) {
                    finalResponse = translatedResponse;
                    console.log(`✅ Respuesta traducida: ${finalResponse.substring(0, 50)}...`);
                  } else {
                    console.log(`⚠️ Error en traducción, usando respuesta original`);
                  }
                }
              }
            } catch (translateError) {
              console.log(`⚠️ Sistema de traducción no disponible, usando respuesta original`);
            }
            
            const sendResponse = await fetch('http://localhost:5173/api/whatsapp/send-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountId: 1,
                chatId: chatId,
                message: finalResponse
              })
            });
            
            if (sendResponse.ok) {
              console.log(`🚀 Respuesta automática enviada a ${chatId}`);
            } else {
              console.log(`❌ Error enviando respuesta automática`);
            }
          } catch (error) {
            console.error('Error enviando respuesta:', error);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error generando respuesta automática:', error);
    }
  }

  async translateText(text: string, fromLang: string, toLang: string): Promise<string | null> {
    try {
      const response = await fetch('http://localhost:5173/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          from: fromLang,
          to: toLang
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.translatedText;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

export const autoResponseMonitor = new AutoResponseMonitor();