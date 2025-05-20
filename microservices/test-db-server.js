/**
 * Script para probar el servidor de base de datos individualmente
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Iniciando servidor de base de datos...');

// Variables de entorno 
const env = { 
  ...process.env, 
  DATABASE_SERVER_PORT: 5003,
  NODE_ENV: 'development'
};

// Iniciar proceso
const dbServerPath = path.join(__dirname, 'database-server', 'index.js');
const proc = spawn('node', [dbServerPath], {
  env: env,
  stdio: 'inherit'
});

proc.on('error', (err) => {
  console.error('Error iniciando servidor de base de datos:', err);
});

proc.on('close', (code) => {
  console.log(`Servidor de base de datos finalizado con código: ${code}`);
});

console.log('Servidor de base de datos iniciado en http://localhost:5003');
console.log('Presiona Ctrl+C para detener');