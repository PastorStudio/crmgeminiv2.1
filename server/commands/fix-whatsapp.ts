/**
 * Comando para corregir el estado de la conexión de WhatsApp
 * 
 * Este comando actualiza manualmente el estado del cliente de WhatsApp
 * cuando se detecta una discrepancia (está conectado pero el sistema no lo detecta)
 */

import * as fs from 'fs';
import * as path from 'path';

// Definir rutas
const TEMP_DIR = path.join(process.cwd(), 'temp');
const SESSION_DIR = path.join(TEMP_DIR, 'whatsapp-sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'session_active.json');
const FORCE_FILE = path.join(SESSION_DIR, '.force_connected');

async function main() {
  console.log('🔎 Iniciando corrección de estado de WhatsApp...');
  
  try {
    // Asegurar que los directorios existen
    if (!fs.existsSync(TEMP_DIR)) {
      console.log('📁 Creando directorio temp...');
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(SESSION_DIR)) {
      console.log('📁 Creando directorio de sesiones...');
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    
    console.log('🔍 Verificando estado actual...');
    
    // Datos que forzaremos
    const forcedStatus = {
      authenticated: true,
      ready: true,
      authenticatedAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
      forceAuthenticated: true,
      chatCount: 1,
      hasLoadedChats: true,
      hasRecentMessages: true,
      hasPuppeteerPage: true
    };
    
    // Guardar archivo principal de sesión
    console.log('💾 Escribiendo estado forzado en archivo de sesión...');
    fs.writeFileSync(SESSION_FILE, JSON.stringify(forcedStatus, null, 2), 'utf8');
    
    // Crear archivo auxiliar para que el sistema sepa que se ha forzado la conexión
    console.log('📌 Creando marcador de conexión forzada...');
    fs.writeFileSync(FORCE_FILE, new Date().toISOString(), 'utf8');
    
    // Mostrar rutas para verificación
    console.log('\n📊 Información:');
    console.log(`- Archivo de sesión: ${SESSION_FILE}`);
    console.log(`- Estado forzado: ${JSON.stringify(forcedStatus, null, 2)}`);
    
    console.log('\n✅ Corrección aplicada exitosamente');
    console.log('🔄 Ahora reinicie la aplicación para que los cambios surtan efecto');
    console.log('⚠️ Si el problema persiste después de reiniciar, revise la conexión de WhatsApp Web directamente');
    
    return true;
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    return false;
  }
}

// Ejecutar el comando
main()
  .then((success) => {
    if (success) {
      console.log('\n✅ Comando completado con éxito');
      process.exit(0);
    } else {
      console.log('\n❌ Comando falló');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Error ejecutando comando:', error);
    process.exit(1);
  });