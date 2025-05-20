/**
 * Script para ejecutar el servidor API
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor API...');

// Variables de entorno
const env = {
  ...process.env,
  API_SERVER_PORT: 5000,
  DATABASE_SERVER_URL: 'http://localhost:5003',
  WHATSAPP_SERVER_URL: 'http://localhost:5001',
  PROCESSOR_SERVER_URL: 'http://localhost:5002',
  NODE_ENV: 'development'
};

// Ruta al servidor
const apiServerPath = path.join(__dirname, 'api-server', 'index.js');

// Iniciar el proceso
const apiServer = spawn('node', [apiServerPath], {
  env,
  stdio: 'inherit'
});

apiServer.on('error', (err) => {
  console.error('❌ Error iniciando servidor API:', err);
});

apiServer.on('close', (code) => {
  console.log(`💫 Servidor API finalizado con código: ${code}`);
});

console.log('✅ Servidor API iniciado en http://localhost:5000');
console.log('⚠️ Presiona Ctrl+C para detener el servidor');