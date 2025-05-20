/**
 * Script para iniciar el servidor de base de datos independientemente
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuración
const PORT = process.env.DATABASE_SERVER_PORT || 5003;
const script = path.join(__dirname, 'database-server', 'index.js');

console.log('=== INICIANDO SERVIDOR DE BASE DE DATOS ===');
console.log(`Puerto: ${PORT}`);
console.log(`Script: ${script}`);
console.log('====================================');

// Configurar variables de entorno
const env = {
  ...process.env,
  PORT,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Iniciar el proceso
const proc = spawn('node', [script], {
  env,
  stdio: 'inherit'
});

// Manejar terminación
proc.on('close', (code) => {
  console.log(`Servidor de base de datos terminado con código ${code}`);
  process.exit(code);
});

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('Señal de interrupción recibida');
  proc.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Señal de terminación recibida');
  proc.kill('SIGTERM');
});