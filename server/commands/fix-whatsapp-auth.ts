/**
 * Este comando fuerza la actualización del estado de autenticación de WhatsApp
 * cuando se detecta que el sistema está desincronizado con el estado real.
 * 
 * Método de uso:
 *   1. Ejecutar en la terminal: npx tsx server/commands/fix-whatsapp-auth.ts
 *   2. Reiniciar la aplicación después
 */

import fs from 'fs';
import path from 'path';

// Ruta al archivo de estado de sesión en la carpeta temp
const TEMP_DIR = path.join(process.cwd(), 'temp');
const WHATSAPP_DIR = path.join(TEMP_DIR, 'whatsapp-sessions');
const SESSION_FILE = path.join(WHATSAPP_DIR, 'session_active.json');

// Estado de autenticación que forzaremos
const FORCED_AUTH_STATE = {
  authenticated: true,
  ready: true,
  authenticatedAt: new Date().toISOString(),
  activatedAt: new Date().toISOString(),
  connectionFixed: true,
  forceAuthenticated: true
};

async function main() {
  console.log('🔧 Iniciando corrección para forzar estado de autenticación de WhatsApp...');
  
  try {
    // Asegurar que el directorio existe
    if (!fs.existsSync(WHATSAPP_DIR)) {
      fs.mkdirSync(WHATSAPP_DIR, { recursive: true });
      console.log('📁 Creado directorio de sesiones de WhatsApp');
    }
    
    // Escribir nuevo estado al archivo
    fs.writeFileSync(
      SESSION_FILE, 
      JSON.stringify(FORCED_AUTH_STATE, null, 2),
      'utf8'
    );
    
    console.log('✅ Estado de autenticación forzado exitosamente');
    console.log('⚠️ Para que los cambios tengan efecto, reinicie la aplicación');
    console.log('   Puede hacerlo deteniendo y reiniciando el workflow "Start application"');
    
  } catch (error) {
    console.error('❌ Error durante la corrección de estado:', error);
  }
}

// Ejecutar la función principal
main().then(() => {
  console.log('✨ Comando completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});