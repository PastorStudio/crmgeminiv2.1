/**
 * Funciones automáticas mejoradas para WhatsApp
 * 1. Auto-click del botón A.E. después de detectar mensaje nuevo (2 segundos)
 * 2. Auto-envío mejorado del área de input (3-5 segundos)
 */

// Variables globales para control de estado
let autoAEEnabled = false;
let autoSendEnabled = false;
let lastMessageCount = 0;
let autoAETimer: NodeJS.Timeout | null = null;
let autoSendTimer: NodeJS.Timeout | null = null;
let messageMonitorInterval: NodeJS.Timeout | null = null;
let inputMonitorInterval: NodeJS.Timeout | null = null;
let lastInputContent = '';

/**
 * 1. FUNCIÓN AUTO-CLICK BOTÓN A.E.
 * Detecta mensaje nuevo y hace click en botón A.E. azul después de 2 segundos
 */

// Detectar nuevos mensajes entrantes
function detectNewIncomingMessage(): boolean {
  try {
    // Múltiples métodos para detectar mensajes
    const messageSelectors = [
      '[data-testid="msg-container"]',
      '.message',
      '[class*="message"]',
      '.chat-message',
      '[data-message-id]'
    ];
    
    let messageElements: NodeListOf<Element> | null = null;
    
    for (let i = 0; i < messageSelectors.length; i++) {
      messageElements = document.querySelectorAll(messageSelectors[i]);
      if (messageElements.length > 0) break;
    }
    
    if (!messageElements || messageElements.length === 0) {
      return false;
    }
    
    const currentCount = messageElements.length;
    
    // Verificar si hay mensajes nuevos
    if (currentCount > lastMessageCount) {
      // Verificar que el último mensaje no sea nuestro (mensaje entrante)
      const lastMessage = messageElements[messageElements.length - 1];
      const isIncoming = !lastMessage.querySelector('[data-testid="msg-meta-out"]') && 
                        !lastMessage.className.includes('outgoing') &&
                        !lastMessage.className.includes('fromMe');
      
      if (isIncoming) {
        console.log(`📨 NUEVO MENSAJE ENTRANTE DETECTADO (${lastMessageCount} → ${currentCount})`);
        lastMessageCount = currentCount;
        return true;
      }
    }
    
    // Actualizar contador sin detectar como nuevo mensaje
    lastMessageCount = Math.max(lastMessageCount, currentCount);
    return false;
  } catch (error) {
    console.error('❌ Error detectando mensajes:', error);
    return false;
  }
}

// Buscar y hacer click en botón A.E. azul
function clickAEButton(): boolean {
  try {
    console.log('🔍 Buscando botón A.E. azul...');
    
    // Métodos múltiples para encontrar el botón A.E.
    const searchMethods = [
      // Método 1: Por texto exacto
      () => Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent?.trim() === 'A.E' || btn.textContent?.includes('A.E')
      ),
      
      // Método 2: Por clase CSS azul
      () => Array.from(document.querySelectorAll('button')).find(btn => 
        (btn.className?.includes('bg-blue') || btn.className?.includes('blue')) &&
        btn.textContent?.includes('A.E')
      ),
      
      // Método 3: Por aria-label o title
      () => document.querySelector('button[aria-label*="A.E"], button[title*="A.E"]'),
      
      // Método 4: Por ID o data attributes
      () => document.querySelector('button[id*="ae"], button[data-ae], button[data-auto]'),
      
      // Método 5: Buscar en área específica de último recibido
      () => {
        const indicators = document.querySelectorAll('[class*="ultimo"], [class*="recibido"], [class*="last"]');
        for (let i = 0; i < indicators.length; i++) {
          const indicator = indicators[i];
          const nearby = indicator.parentElement?.querySelectorAll('button') || [];
          for (let j = 0; j < nearby.length; j++) {
            const btn = nearby[j];
            if (btn.textContent?.includes('A.E')) return btn;
          }
        }
        return null;
      }
    ];
    
    let aeButton = null;
    
    for (const method of searchMethods) {
      aeButton = method();
      if (aeButton && !aeButton.disabled) {
        console.log('🎯 BOTÓN A.E. ENCONTRADO - HACIENDO CLICK');
        aeButton.click();
        return true;
      }
    }
    
    console.log('❌ No se encontró botón A.E. disponible');
    return false;
  } catch (error) {
    console.error('❌ Error haciendo click en A.E.:', error);
    return false;
  }
}

// Monitorear mensajes y activar A.E. automáticamente
function startAutoAEMonitoring() {
  if (messageMonitorInterval) {
    clearInterval(messageMonitorInterval);
  }
  
  console.log('🚀 INICIANDO MONITOREO AUTO A.E.');
  
  messageMonitorInterval = setInterval(() => {
    if (!autoAEEnabled) return;
    
    const hasNewMessage = detectNewIncomingMessage();
    
    if (hasNewMessage) {
      console.log('⏰ Nuevo mensaje detectado, esperando 2 segundos para A.E...');
      
      // Esperar 2 segundos como especifica el usuario
      setTimeout(() => {
        if (autoAEEnabled) {
          clickAEButton();
        }
      }, 2000);
    }
  }, 1000); // Revisar cada segundo
}

/**
 * 2. FUNCIÓN AUTO-ENVÍO MEJORADA
 * Auto-envío del input cada 3-5 segundos (aleatorio)
 */

// Buscar y enviar mensaje del input (MEJORADO PARA DETECTAR RESPUESTAS DEL AGENTE)
function autoSendFromInput(): boolean {
  try {
    console.log('📤 Buscando área de input para auto-envío...');
    
    // Buscar área de input con texto (más selectores y más agresivo)
    const inputSelectors = [
      'input[type="text"]',
      'textarea',
      '[contenteditable="true"]',
      'input[placeholder*="mensaje"]',
      'textarea[placeholder*="mensaje"]',
      '[data-testid="compose-text"]',
      '[class*="input"]',
      '[class*="text-area"]',
      '[class*="compose"]',
      'div[role="textbox"]',
      'span[data-testid="conversation-compose-box-input"]'
    ];
    
    let inputElement = null;
    let messageText = '';
    
    // Buscar en todos los selectores posibles
    for (const selector of inputSelectors) {
      const inputs = document.querySelectorAll(selector);
      for (const input of inputs) {
        // Obtener valor de múltiples formas
        let value = '';
        if (input.value) value = input.value;
        else if (input.textContent) value = input.textContent;
        else if (input.innerText) value = input.innerText;
        else if (input.innerHTML) value = input.innerHTML.replace(/<[^>]*>/g, ''); // Remover HTML tags
        
        if (value.trim().length > 0) {
          inputElement = input;
          messageText = value.trim();
          break;
        }
      }
      if (inputElement) break;
    }
    
    // Si no encontramos nada, buscar de forma más agresiva
    if (!inputElement) {
      // Buscar cualquier elemento que pueda contener texto generado por el agente
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        const computedStyle = window.getComputedStyle(element);
        const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
        
        if (isVisible && (element.isContentEditable || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
          let value = '';
          if (element.value) value = element.value;
          else if (element.textContent) value = element.textContent;
          else if (element.innerText) value = element.innerText;
          
          if (value.trim().length > 0) {
            inputElement = element;
            messageText = value.trim();
            break;
          }
        }
      }
    }
    
    if (!inputElement || !messageText) {
      console.log('📝 No hay texto en el input para enviar');
      return false;
    }
    
    console.log(`📨 Texto encontrado en input: "${messageText.substring(0, 50)}..."`);
    
    // Buscar botón de envío con múltiples métodos
    const sendMethods = [
      // Método 1: Por texto
      () => Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent?.toLowerCase().includes('enviar') ||
        btn.textContent?.toLowerCase().includes('send')
      ),
      
      // Método 2: Por clase CSS verde o azul
      () => Array.from(document.querySelectorAll('button')).find(btn => 
        (btn.className?.includes('bg-green') || btn.className?.includes('bg-blue')) &&
        !btn.disabled
      ),
      
      // Método 3: Por ícono SVG de envío
      () => Array.from(document.querySelectorAll('button')).find(btn => {
        const svg = btn.querySelector('svg');
        return svg && !btn.disabled;
      }),
      
      // Método 4: Botón cerca del input
      () => {
        const inputContainer = inputElement.closest('div, form');
        if (inputContainer) {
          const buttons = inputContainer.querySelectorAll('button');
          return Array.from(buttons).find(btn => !btn.disabled);
        }
        return null;
      },
      
      // Método 5: Último botón en el área de input
      () => {
        const allButtons = document.querySelectorAll('button');
        return Array.from(allButtons).filter(btn => !btn.disabled).pop();
      }
    ];
    
    let sendButton = null;
    
    for (const method of sendMethods) {
      sendButton = method();
      if (sendButton && !sendButton.disabled) {
        console.log('🚀 BOTÓN ENVIAR ENCONTRADO - ENVIANDO MENSAJE');
        sendButton.click();
        
        // Limpiar input después de enviar
        setTimeout(() => {
          if (inputElement.value !== undefined) {
            inputElement.value = '';
          } else {
            inputElement.textContent = '';
          }
          // Disparar evento para que React detecte el cambio
          const event = new Event('input', { bubbles: true });
          inputElement.dispatchEvent(event);
        }, 500);
        
        return true;
      }
    }
    
    console.log('❌ No se encontró botón de envío disponible');
    return false;
  } catch (error) {
    console.error('❌ Error en auto-envío:', error);
    return false;
  }
}

// Monitor continuo del input para detectar contenido generado por agentes
function startInputMonitoring() {
  if (inputMonitorInterval) {
    clearInterval(inputMonitorInterval);
  }
  
  console.log('🔍 INICIANDO MONITOREO CONTINUO DEL INPUT');
  
  inputMonitorInterval = setInterval(() => {
    if (!autoSendEnabled) return;
    
    // Buscar cualquier input con contenido
    const inputSelectors = [
      'input[type="text"]',
      'textarea',
      '[contenteditable="true"]',
      'input[placeholder*="mensaje"]',
      'textarea[placeholder*="mensaje"]',
      '[data-testid="compose-text"]',
      '[class*="input"]',
      '[class*="text-area"]',
      '[class*="compose"]',
      'div[role="textbox"]'
    ];
    
    let currentContent = '';
    
    for (const selector of inputSelectors) {
      const inputs = document.querySelectorAll(selector);
      for (const input of Array.from(inputs)) {
        let value = '';
        if ((input as any).value) value = (input as any).value;
        else if (input.textContent) value = input.textContent;
        else if ((input as any).innerText) value = (input as any).innerText;
        
        if (value.trim().length > 0) {
          currentContent = value.trim();
          break;
        }
      }
      if (currentContent) break;
    }
    
    // Si hay contenido nuevo, enviar inmediatamente
    if (currentContent && currentContent !== lastInputContent) {
      console.log(`🚀 CONTENIDO NUEVO DETECTADO: "${currentContent.substring(0, 50)}..."`);
      lastInputContent = currentContent;
      
      // Enviar inmediatamente sin esperar
      const sent = autoSendFromInput();
      if (sent) {
        console.log('✅ AUTO-ENVÍO INSTANTÁNEO COMPLETADO');
        lastInputContent = ''; // Reset para detectar próximo contenido
      }
    }
  }, 500); // Revisar cada 500ms para detección rápida
}

// Programar auto-envío de respaldo (en caso de que el monitor no funcione)
function scheduleNextAutoSend() {
  if (autoSendTimer) {
    clearTimeout(autoSendTimer);
  }
  
  if (!autoSendEnabled) return;
  
  // Tiempo más largo como respaldo: 3-5 segundos
  const randomDelay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
  console.log(`⏰ Próximo auto-envío de respaldo en ${randomDelay/1000} segundos`);
  
  autoSendTimer = setTimeout(() => {
    if (autoSendEnabled) {
      const sent = autoSendFromInput();
      if (sent) {
        console.log('✅ Auto-envío de respaldo completado');
      }
      scheduleNextAutoSend();
    }
  }, randomDelay);
}

/**
 * FUNCIONES PÚBLICAS DE CONTROL
 */

// Activar auto-click A.E.
export function enableAutoAE() {
  console.log('🟢 ACTIVANDO AUTO A.E.');
  autoAEEnabled = true;
  startAutoAEMonitoring();
}

// Desactivar auto-click A.E.
export function disableAutoAE() {
  console.log('🔴 DESACTIVANDO AUTO A.E.');
  autoAEEnabled = false;
  if (messageMonitorInterval) {
    clearInterval(messageMonitorInterval);
    messageMonitorInterval = null;
  }
  if (autoAETimer) {
    clearTimeout(autoAETimer);
    autoAETimer = null;
  }
}

// Activar auto-envío
export function enableAutoSend() {
  console.log('🟢 ACTIVANDO AUTO-ENVÍO CON MONITOREO CONTINUO');
  autoSendEnabled = true;
  lastInputContent = ''; // Reset del contenido previo
  startInputMonitoring(); // Iniciar monitoreo continuo del input
  scheduleNextAutoSend(); // Iniciar respaldo
}

// Desactivar auto-envío
export function disableAutoSend() {
  console.log('🔴 DESACTIVANDO AUTO-ENVÍO Y MONITOREO');
  autoSendEnabled = false;
  if (autoSendTimer) {
    clearTimeout(autoSendTimer);
    autoSendTimer = null;
  }
  if (inputMonitorInterval) {
    clearInterval(inputMonitorInterval);
    inputMonitorInterval = null;
  }
  lastInputContent = ''; // Reset del contenido
}

// Obtener estado actual
export function getAutoFunctionsStatus() {
  return {
    autoAE: autoAEEnabled,
    autoSend: autoSendEnabled
  };
}

// Activar/desactivar ambas funciones
export function toggleAutoAE() {
  if (autoAEEnabled) {
    disableAutoAE();
  } else {
    enableAutoAE();
  }
  return autoAEEnabled;
}

export function toggleAutoSend() {
  if (autoSendEnabled) {
    disableAutoSend();
  } else {
    enableAutoSend();
  }
  return autoSendEnabled;
}

// Limpiar todos los timers al salir
export function cleanupAutoFunctions() {
  disableAutoAE();
  disableAutoSend();
}

// Auto-inicializar al cargar la página
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupAutoFunctions);
}