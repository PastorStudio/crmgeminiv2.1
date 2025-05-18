/**
 * Script de integración para la solución de respuestas automáticas
 * 
 * Este script reemplaza las funciones problemáticas en el servicio actual
 * con las versiones corregidas y optimizadas.
 */

const fs = require('fs');
const path = require('path');
const { generateAIResponse } = require('./fix-auto-response');

// Ruta al archivo principal del servicio de WhatsApp
const whatsappServicePath = path.join(__dirname, 'whatsappServiceImpl.js');

// Verificar si el archivo existe
if (!fs.existsSync(whatsappServicePath)) {
  console.error(`No se encontró el archivo del servicio de WhatsApp en ${whatsappServicePath}`);
  process.exit(1);
}

// Función para manejar mensajes entrantes con la versión corregida
async function handleIncomingMessage(message) {
  try {
    console.log('Procesando mensaje entrante:', message.body);
    
    // Ignorar mensajes enviados por nosotros mismos
    if (message.fromMe) {
      console.log('Mensaje propio, ignorando');
      return;
    }
    
    // Verificar si es un grupo (opcional, depende de la configuración)
    if (message.from.endsWith('@g.us')) {
      console.log('Mensaje de grupo, ignorando');
      return;
    }
    
    // Obtener nombre del contacto para personalización
    let contactName = 'cliente';
    try {
      const contact = await message.getContact();
      contactName = contact.name || contact.pushname || 'cliente';
    } catch (error) {
      console.log('Error obteniendo contacto:', error);
    }
    
    // Generar respuesta con nuestras funciones mejoradas
    const responseText = await generateAIResponse(message.body, contactName);
    
    // Esperar un tiempo aleatorio entre 5 y 15 segundos para simular escritura
    const delay = Math.floor(Math.random() * 10000) + 5000;
    console.log(`Esperando ${delay}ms antes de responder...`);
    
    setTimeout(async () => {
      try {
        // Enviar mensaje de "escribiendo..."
        await message.getChat().then(chat => chat.sendStateTyping());
        
        // Esperar un poco más
        setTimeout(async () => {
          try {
            // Enviar la respuesta
            await message.reply(responseText);
            console.log('Respuesta automática enviada:', responseText);
          } catch (error) {
            console.error('Error enviando respuesta:', error);
          }
        }, 2000);
      } catch (error) {
        console.error('Error enviando estado de escritura:', error);
        // Intentar enviar mensaje directamente si falla el estado de escritura
        try {
          await message.reply(responseText);
          console.log('Respuesta automática enviada (sin estado de escritura):', responseText);
        } catch (innerError) {
          console.error('Error enviando respuesta directa:', innerError);
        }
      }
    }, delay);
    
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
}

// Exportar la función mejorada
module.exports = {
  handleIncomingMessage
};