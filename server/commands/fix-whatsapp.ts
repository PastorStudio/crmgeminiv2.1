/**
 * Comando para corregir el estado de la conexión de WhatsApp
 * 
 * Este comando actualiza manualmente el estado del cliente de WhatsApp
 * cuando se detecta una discrepancia (está conectado pero el sistema no lo detecta)
 */

import fs from 'fs';
import path from 'path';

// Ruta al archivo de estado de sesión
const TEMP_DIR = path.join(process.cwd(), 'temp');
const SESSION_DIR = path.join(TEMP_DIR, 'whatsapp-sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'session_active.json');

// Main function
async function main() {
  console.log('🔧 Iniciando corrección de estado de WhatsApp...');
  
  try {
    // Asegurar que el directorio de sesiones existe
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    
    // Modificar el archivo de sesión para forzar el estado de autenticación
    const sessionData = {
      authenticated: true,
      ready: true,
      authenticatedAt: new Date().toISOString(),
      activatedAt: new Date().toISOString()
    };
    
    // Escribir al archivo
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
    console.log('✅ Archivo de sesión actualizado correctamente');
    
    // Crear un archivo temporal para indicar que se ha forzado la autenticación
    const forceAuthFile = path.join(SESSION_DIR, 'force_auth.flag');
    fs.writeFileSync(forceAuthFile, new Date().toISOString(), 'utf8');
    console.log('✅ Marcador de autenticación forzada creado');
    
    console.log('✅ Corrección completada con éxito');
    console.log('🔄 El sistema debería detectar la conexión después de reiniciar');
    console.log('   Si persiste el problema, los pasos recomendados son:');
    console.log('   1. Reiniciar el servidor (Workflow)');
    console.log('   2. Escanear el código QR nuevamente en WhatsApp');
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  }
}

// Run the main function
main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});