/**
 * Script para ejecutar el servidor de procesamiento de mensajes
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor de procesamiento de mensajes...');

// Variables de entorno
const env = {
  ...process.env,
  PROCESSOR_SERVER_PORT: 5002,
  DATABASE_SERVER_URL: 'http://localhost:5003',
  NODE_ENV: 'development'
};

// Ruta al servidor
const processorServerPath = path.join(__dirname, 'message-processor', 'index.js');

// Iniciar el proceso
const processorServer = spawn('node', [processorServerPath], {
  env,
  stdio: 'inherit'
});

processorServer.on('error', (err) => {
  console.error('❌ Error iniciando servidor de procesamiento:', err);
});

processorServer.on('close', (code) => {
  console.log(`💫 Servidor de procesamiento finalizado con código: ${code}`);
});

console.log('✅ Servidor de procesamiento iniciado en http://localhost:5002');
console.log('⚠️ Presiona Ctrl+C para detener el servidor');