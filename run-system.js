/**
 * Script simplificado para iniciar el sistema de integración WhatsApp
 * Este archivo inicia todos los componentes necesarios para la aplicación
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Iniciando sistema de integración WhatsApp...');

// Crear directorios necesarios
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Iniciar servidor API en el puerto 5000
const apiServer = spawn('node', [path.join(__dirname, 'microservices/api-server/index.js')], {
  env: {
    ...process.env,
    PORT: 5000
  }
});

apiServer.stdout.on('data', (data) => {
  console.log(`API: ${data.toString().trim()}`);
});

apiServer.stderr.on('data', (data) => {
  console.error(`API ERROR: ${data.toString().trim()}`);
});

console.log('Sistema iniciado. Presiona Ctrl+C para detener.');

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('Deteniendo sistema...');
  apiServer.kill();
  setTimeout(() => process.exit(0), 1000);
});