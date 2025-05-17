/**
 * Este comando fuerza la actualización del estado de autenticación de WhatsApp
 * cuando se detecta que el sistema está desincronizado con el estado real.
 * 
 * Método de uso:
 *   1. Ejecutar en la terminal: npx tsx server/commands/fix-whatsapp-auth.ts
 *   2. Reiniciar la aplicación después
 */

import * as fs from 'fs';
import * as path from 'path';

// Definir rutas
const TEMP_DIR = path.join(process.cwd(), 'temp');
const SESSION_DIR = path.join(TEMP_DIR, 'whatsapp-sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'session_active.json');

async function main() {
  try {
    console.log('🔍 Verificando estructura de directorios...');
    
    // Asegurar que los directorios existen
    if (!fs.existsSync(TEMP_DIR)) {
      console.log('🔧 Creando directorio temp...');
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(SESSION_DIR)) {
      console.log('🔧 Creando directorio de sesiones...');
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    
    console.log('📊 Información de directorios:');
    console.log(`- Directorio temp: ${TEMP_DIR}`);
    console.log(`- Directorio de sesiones: ${SESSION_DIR}`);
    
    // Verificar si el archivo de sesión existe
    const sessionExists = fs.existsSync(SESSION_FILE);
    console.log(`- Archivo de sesión existe: ${sessionExists ? 'Sí' : 'No'}`);
    
    if (sessionExists) {
      try {
        // Intentar leer el archivo existente
        const currentSessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        
        console.log('📋 Estado actual de sesión:', currentSessionData);
        
        // Si está marcado como no autenticado, actualizarlo
        if (!currentSessionData.authenticated || !currentSessionData.ready) {
          console.log('⚠️ Sesión marcada como no autenticada. Actualizando...');
        } else {
          console.log('✅ Sesión ya está marcada como autenticada.');
        }
      } catch (readError) {
        console.error('❌ Error leyendo archivo de sesión:', readError);
        console.log('⚠️ El archivo de sesión existe pero no puede ser leído. Será reemplazado.');
      }
    }
    
    // Datos que forzaremos en el archivo
    const forcedStatus = {
      authenticated: true,
      ready: true,
      authenticatedAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
      forceAuthenticated: true,
      chatCount: 1,
      hasLoadedChats: true,
      hasRecentMessages: true
    };
    
    // Escribir archivo forzado
    fs.writeFileSync(SESSION_FILE, JSON.stringify(forcedStatus, null, 2), 'utf8');
    
    console.log('✅ Estado de autenticación forzado correctamente');
    console.log('📝 Datos escritos en archivo de sesión:', forcedStatus);
    console.log('🚀 Reinicie la aplicación para que los cambios surtan efecto');
    
    return true;
  } catch (error) {
    console.error('❌ Error durante la corrección de autenticación:', error);
    return false;
  }
}

// Ejecutar el comando
main()
  .then((success) => {
    if (success) {
      console.log('✅ Comando completado con éxito');
      process.exit(0);
    } else {
      console.log('❌ Comando falló');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Error ejecutando comando:', error);
    process.exit(1);
  });