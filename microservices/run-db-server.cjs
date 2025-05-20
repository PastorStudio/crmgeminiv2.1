/**
 * Script para ejecutar el servidor de base de datos
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor de base de datos...');

// Variables de entorno
const env = {
  ...process.env,
  DATABASE_SERVER_PORT: 5003,
  NODE_ENV: 'development'
};

// Ruta al servidor
const dbServerPath = path.join(__dirname, 'database-server', 'index.js');

// Iniciar el proceso
const dbServer = spawn('node', [dbServerPath], {
  env,
  stdio: 'inherit'
});

dbServer.on('error', (err) => {
  console.error('❌ Error iniciando servidor de base de datos:', err);
});

dbServer.on('close', (code) => {
  console.log(`💫 Servidor de base de datos finalizado con código: ${code}`);
});

console.log('✅ Servidor de base de datos iniciado en http://localhost:5003');
console.log('⚠️ Presiona Ctrl+C para detener el servidor');