/**
 * Script para ejecutar el servidor de WhatsApp
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor de conexiones WhatsApp...');

// Variables de entorno
const env = {
  ...process.env,
  WHATSAPP_SERVER_PORT: 5001,
  DATABASE_SERVER_URL: 'http://localhost:5003',
  PROCESSOR_SERVER_URL: 'http://localhost:5002',
  NODE_ENV: 'development'
};

// Ruta al servidor
const whatsappServerPath = path.join(__dirname, 'whatsapp-server', 'index.js');

// Iniciar el proceso
const whatsappServer = spawn('node', [whatsappServerPath], {
  env,
  stdio: 'inherit'
});

whatsappServer.on('error', (err) => {
  console.error('❌ Error iniciando servidor de WhatsApp:', err);
});

whatsappServer.on('close', (code) => {
  console.log(`💫 Servidor de WhatsApp finalizado con código: ${code}`);
});

console.log('✅ Servidor de WhatsApp iniciado en http://localhost:5001');
console.log('⚠️ Presiona Ctrl+C para detener el servidor');