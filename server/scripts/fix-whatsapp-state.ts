/**
 * Script para corregir el estado de la conexión de WhatsApp
 * 
 * Este script realiza una verificación profunda del estado real de WhatsApp
 * y lo sincroniza con el estado del sistema.
 */
import { whatsappService } from '../services/whatsappServiceImpl';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Iniciando corrección de estado de WhatsApp...');
  
  try {
    // 1. Realizar verificación profunda de autenticación
    console.log('Realizando verificación profunda del estado real de WhatsApp...');
    const authStatus = await whatsappService.checkAuthenticationDirect();
    
    console.log('Diagnóstico de autenticación:', JSON.stringify(authStatus, null, 2));
    
    // 2. Verificar si los chats están cargados
    console.log('Verificando chats disponibles...');
    const chats = await whatsappService.getChats().catch(e => {
      console.log('Error obteniendo chats:', e);
      return [];
    });
    
    console.log(`Encontrados ${chats.length} chats`);
    
    // 3. Verificar estado oficial si es posible
    const client = whatsappService.getClient();
    if (client) {
      try {
        const state = await client.getState();
        console.log(`Estado oficial del cliente: ${state}`);
      } catch (e) {
        console.log('No se pudo obtener estado oficial:', e);
      }
    }
    
    // 4. Actualizar el estado del sistema basado en los hallazgos
    if (authStatus.authenticated) {
      console.log('¡AUTENTICADO! Actualizando estado del sistema...');
      
      // Forzar actualización de estado
      const status = whatsappService.getStatus();
      status.authenticated = true;
      status.ready = true;
      
      // Guardar en archivo para persistencia
      try {
        const sessionDir = path.join(process.cwd(), 'temp', 'whatsapp-sessions');
        const statusFile = path.join(sessionDir, 'session_active.json');
        
        // Asegurar que el directorio existe
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Escribir información actualizada al archivo
        fs.writeFileSync(statusFile, JSON.stringify({
          authenticated: true,
          ready: true,
          activatedAt: new Date().toISOString(),
          authenticatedAt: new Date().toISOString()
        }), 'utf8');
        
        console.log('Estado guardado en archivo de sesión');
      } catch (fsError) {
        console.error('Error guardando archivo de estado:', fsError);
      }
    } else {
      console.log('No autenticado según verificación profunda. No se realizan cambios.');
    }
    
    // Mostrar estado final
    console.log('Estado final:', whatsappService.getStatus());
    
  } catch (error) {
    console.error('Error en proceso de corrección:', error);
  }
  
  console.log('Proceso de corrección completado');
}

// Ejecutar y salir después de un tiempo
main().then(() => {
  console.log('Ejecutando por 5 segundos más para permitir operaciones asíncronas...');
  setTimeout(() => {
    console.log('Fin del script');
    process.exit(0);
  }, 5000);
}).catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});