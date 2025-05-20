/**
 * Script para iniciar todos los microservicios
 * 
 * Este script inicia todos los microservicios en orden: 
 * 1. Servidor de base de datos
 * 2. Servidor de WhatsApp
 * 3. Servidor de procesamiento de mensajes
 * 4. Servidor de API
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuración de puertos
const PORTS = {
  DATABASE: process.env.DATABASE_SERVER_PORT || 5003,
  WHATSAPP: process.env.WHATSAPP_SERVER_PORT || 5001,
  PROCESSOR: process.env.MESSAGE_PROCESSOR_PORT || 5002,
  API: process.env.API_SERVER_PORT || 5000
};

// URLs de los servicios
const SERVICE_URLS = {
  DATABASE: process.env.DATABASE_SERVER_URL || `http://localhost:${PORTS.DATABASE}`,
  WHATSAPP: process.env.WHATSAPP_SERVER_URL || `http://localhost:${PORTS.WHATSAPP}`,
  PROCESSOR: process.env.PROCESSOR_SERVER_URL || `http://localhost:${PORTS.PROCESSOR}`,
  API: process.env.API_SERVER_URL || `http://localhost:${PORTS.API}`
};

// Configuración de servicios
const SERVICES = [
  {
    name: 'database',
    script: path.join(__dirname, 'database-server', 'index.js'),
    port: PORTS.DATABASE,
    healthEndpoint: '/health',
    readyTimeout: 5000, // ms
    color: '\x1b[36m' // Cyan
  },
  {
    name: 'whatsapp',
    script: path.join(__dirname, 'whatsapp-server', 'index.js'),
    port: PORTS.WHATSAPP,
    healthEndpoint: '/health',
    readyTimeout: 5000, // ms
    color: '\x1b[32m' // Verde
  },
  {
    name: 'processor',
    script: path.join(__dirname, 'message-processor', 'index.js'),
    port: PORTS.PROCESSOR,
    healthEndpoint: '/health',
    readyTimeout: 5000, // ms
    color: '\x1b[35m' // Magenta
  },
  {
    name: 'api',
    script: path.join(__dirname, 'api-server', 'index.js'),
    port: PORTS.API,
    healthEndpoint: '/api/health',
    readyTimeout: 5000, // ms
    color: '\x1b[33m' // Amarillo
  }
];

// Directorio de logs
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Mapa de procesos activos
const processes = new Map();

// Función para iniciar un servicio
function startService(service) {
  return new Promise((resolve, reject) => {
    console.log(`${service.color}[${service.name.toUpperCase()}] Iniciando servicio en puerto ${service.port}...\x1b[0m`);
    
    // Crear archivos de log
    const logFile = fs.createWriteStream(path.join(LOGS_DIR, `${service.name}.log`), { flags: 'a' });
    const errorLogFile = fs.createWriteStream(path.join(LOGS_DIR, `${service.name}-error.log`), { flags: 'a' });
    
    // Configurar variables de entorno específicas del servicio
    const env = {
      ...process.env,
      PORT: service.port,
      DATABASE_SERVER_URL: SERVICE_URLS.DATABASE,
      WHATSAPP_SERVER_URL: SERVICE_URLS.WHATSAPP,
      PROCESSOR_SERVER_URL: SERVICE_URLS.PROCESSOR,
      API_SERVER_URL: SERVICE_URLS.API,
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
      
      // Si el código es inesperado (no fue debido a SIGTERM por stop), reiniciar
      if (code !== 0 && !proc.terminated) {
        console.log(`${service.color}[${service.name.toUpperCase()}] Reiniciando servicio...\x1b[0m`);
        setTimeout(() => startService(service), 5000);
      }
    });
    
    // Esperar un poco para que el servicio inicie
    setTimeout(() => {
      console.log(`${service.color}[${service.name.toUpperCase()}] Servicio iniciado (PID: ${proc.pid})\x1b[0m`);
      resolve(proc);
    }, service.readyTimeout);
  });
}

// Función para detener un servicio
function stopService(serviceName) {
  return new Promise((resolve, reject) => {
    const proc = processes.get(serviceName);
    if (!proc) {
      console.log(`[${serviceName.toUpperCase()}] Servicio no está en ejecución`);
      resolve();
      return;
    }
    
    console.log(`[${serviceName.toUpperCase()}] Deteniendo servicio (PID: ${proc.pid})...`);
    
    // Marcar que estamos terminando intencionalmente
    proc.terminated = true;
    
    // Enviar señal de terminación
    proc.kill('SIGTERM');
    
    // Timeout para matar forzosamente si no termina
    const killTimeout = setTimeout(() => {
      console.log(`[${serviceName.toUpperCase()}] Forzando terminación...`);
      proc.kill('SIGKILL');
    }, 5000);
    
    // Cuando termina, limpiar y resolver
    proc.on('close', () => {
      clearTimeout(killTimeout);
      processes.delete(serviceName);
      console.log(`[${serviceName.toUpperCase()}] Servicio detenido`);
      resolve();
    });
  });
}

// Función para detener todos los servicios
async function stopAllServices() {
  console.log('\nDeteniendo todos los servicios...');
  
  // Detener en orden inverso
  for (const service of [...SERVICES].reverse()) {
    await stopService(service.name);
  }
  
  console.log('Todos los servicios detenidos');
}

// Función principal
async function main() {
  console.log('=== INICIANDO MICROSERVICIOS ===');
  
  try {
    // Iniciar los servicios en orden
    for (const service of SERVICES) {
      await startService(service);
    }
    
    console.log('\n✅ Todos los servicios iniciados correctamente');
    console.log('\nURLs de servicio:');
    console.log(`🗄️  Base de datos: http://localhost:${PORTS.DATABASE}`);
    console.log(`📱 WhatsApp: http://localhost:${PORTS.WHATSAPP}`);
    console.log(`🧠 Procesador: http://localhost:${PORTS.PROCESSOR}`);
    console.log(`🌐 API: http://localhost:${PORTS.API}`);
    
    console.log('\nPresiona Ctrl+C para detener todos los servicios');
  } catch (error) {
    console.error('Error al iniciar servicios:', error);
    await stopAllServices();
    process.exit(1);
  }
}

// Manejar señales de terminación
process.on('SIGINT', async () => {
  console.log('\nSeñal de interrupción recibida');
  await stopAllServices();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nSeñal de terminación recibida');
  await stopAllServices();
  process.exit(0);
});

// Iniciar el programa
main();