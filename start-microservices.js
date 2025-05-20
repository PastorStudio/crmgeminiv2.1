/**
 * Script para iniciar todos los microservicios
 * 
 * Este script inicia los microservicios en orden:
 * 1. Servidor de base de datos
 * 2. Servidor de WhatsApp
 * 3. Servidor de procesamiento de mensajes
 * 4. Servidor de API
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Crear directorios necesarios
const MICROSERVICES_DIR = path.join(__dirname, 'microservices');
const LOGS_DIR = path.join(MICROSERVICES_DIR, 'logs');
const TEMP_DIR = path.join(MICROSERVICES_DIR, 'temp');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Configuración de puertos
const PORTS = {
  DATABASE: process.env.DATABASE_SERVER_PORT || 5003,
  WHATSAPP: process.env.WHATSAPP_SERVER_PORT || 5001,
  PROCESSOR: process.env.MESSAGE_PROCESSOR_PORT || 5002,
  API: process.env.API_SERVER_PORT || 5000
};

// Configuración de servicios
const SERVICES = [
  {
    name: 'database',
    script: path.join(MICROSERVICES_DIR, 'database-server', 'index.js'),
    port: PORTS.DATABASE,
    color: '\x1b[36m' // Cyan
  },
  {
    name: 'whatsapp',
    script: path.join(MICROSERVICES_DIR, 'whatsapp-server', 'index.js'),
    port: PORTS.WHATSAPP,
    color: '\x1b[32m' // Verde
  },
  {
    name: 'processor',
    script: path.join(MICROSERVICES_DIR, 'message-processor', 'index.js'),
    port: PORTS.PROCESSOR,
    color: '\x1b[35m' // Magenta
  },
  {
    name: 'api',
    script: path.join(MICROSERVICES_DIR, 'api-server', 'index.js'),
    port: PORTS.API,
    color: '\x1b[33m' // Amarillo
  }
];

// Mapa de procesos activos
const processes = new Map();

// Función para iniciar un servicio
function startService(service) {
  console.log(`${service.color}[${service.name.toUpperCase()}] Iniciando servicio en puerto ${service.port}...\x1b[0m`);
  
  // Crear archivos de log
  const logFile = fs.createWriteStream(path.join(LOGS_DIR, `${service.name}.log`), { flags: 'a' });
  const errorLogFile = fs.createWriteStream(path.join(LOGS_DIR, `${service.name}-error.log`), { flags: 'a' });
  
  // Configurar variables de entorno específicas del servicio
  const env = {
    ...process.env,
    PORT: service.port,
    DATABASE_SERVER_URL: `http://localhost:${PORTS.DATABASE}`,
    WHATSAPP_SERVER_URL: `http://localhost:${PORTS.WHATSAPP}`,
    PROCESSOR_SERVER_URL: `http://localhost:${PORTS.PROCESSOR}`,
    API_SERVER_URL: `http://localhost:${PORTS.API}`,
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
  
  // Iniciar el proceso
  const proc = spawn('node', [service.script], { env });
  processes.set(service.name, proc);
  
  // Manejar salidas
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`${service.color}[${service.name.toUpperCase()}] ${output.trim()}\x1b[0m`);
    logFile.write(`${new Date().toISOString()} - ${output}`);
  });
  
  proc.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(`${service.color}[${service.name.toUpperCase()}] ERROR: ${output.trim()}\x1b[0m`);
    errorLogFile.write(`${new Date().toISOString()} - ${output}`);
  });
  
  // Manejar cierre del proceso
  proc.on('close', (code) => {
    console.log(`${service.color}[${service.name.toUpperCase()}] Proceso terminado con código ${code}\x1b[0m`);
    processes.delete(service.name);
    
    // Si el código es inesperado, reiniciar
    if (code !== 0 && !proc.terminated) {
      console.log(`${service.color}[${service.name.toUpperCase()}] Reiniciando servicio...\x1b[0m`);
      setTimeout(() => startService(service), 5000);
    }
  });
  
  // Esperar un poco para iniciar el siguiente servicio
  return new Promise(resolve => {
    setTimeout(() => {
      console.log(`${service.color}[${service.name.toUpperCase()}] Servicio iniciado (PID: ${proc.pid})\x1b[0m`);
      resolve(proc);
    }, 3000);
  });
}

// Función para detener un servicio
function stopService(serviceName) {
  const proc = processes.get(serviceName);
  if (!proc) {
    console.log(`[${serviceName.toUpperCase()}] Servicio no está en ejecución`);
    return;
  }
  
  console.log(`[${serviceName.toUpperCase()}] Deteniendo servicio (PID: ${proc.pid})...`);
  
  // Marcar que estamos terminando intencionalmente
  proc.terminated = true;
  
  // Enviar señal de terminación
  proc.kill('SIGTERM');
}

// Función para detener todos los servicios
function stopAllServices() {
  console.log('\nDeteniendo todos los servicios...');
  
  // Detener en orden inverso
  for (const service of [...SERVICES].reverse()) {
    stopService(service.name);
  }
}

// Función principal
async function main() {
  console.log('=== INICIANDO MICROSERVICIOS ===');
  
  // Iniciar los servicios en orden
  for (const service of SERVICES) {
    try {
      await startService(service);
    } catch (error) {
      console.error(`Error al iniciar servicio ${service.name}:`, error);
    }
  }
  
  console.log('\n✅ Todos los servicios iniciados correctamente');
  console.log('\nURLs de servicio:');
  console.log(`🗄️  Base de datos: http://localhost:${PORTS.DATABASE}`);
  console.log(`📱 WhatsApp: http://localhost:${PORTS.WHATSAPP}`);
  console.log(`🧠 Procesador: http://localhost:${PORTS.PROCESSOR}`);
  console.log(`🌐 API: http://localhost:${PORTS.API}`);
  
  console.log('\nPresiona Ctrl+C para detener todos los servicios');
}

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('\nSeñal de interrupción recibida');
  stopAllServices();
  setTimeout(() => process.exit(0), 3000);
});

process.on('SIGTERM', () => {
  console.log('\nSeñal de terminación recibida');
  stopAllServices();
  setTimeout(() => process.exit(0), 3000);
});

// Iniciar el programa
main();