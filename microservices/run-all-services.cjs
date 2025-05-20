/**
 * Script maestro para ejecutar todos los microservicios a la vez
 * Ejecutar con: node microservices/run-all-services.cjs
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('🚀 Iniciando sistema de microservicios v1.0');
console.log('==========================================');

// Variables de entorno comunes
const env = {
  ...process.env,
  DATABASE_SERVER_PORT: 5003,
  PROCESSOR_SERVER_PORT: 5002,
  WHATSAPP_SERVER_PORT: 5001,
  API_SERVER_PORT: 5000,
  DATABASE_SERVER_URL: 'http://localhost:5003',
  PROCESSOR_SERVER_URL: 'http://localhost:5002',
  WHATSAPP_SERVER_URL: 'http://localhost:5001',
  API_SERVER_URL: 'http://localhost:5000',
  NODE_ENV: 'development'
};

// Lista de servicios a iniciar, en orden
const services = [
  {
    name: 'Database Server',
    script: path.join(__dirname, 'database-server', 'index.js'),
    logFile: path.join(logsDir, 'database-server.log'),
    port: env.DATABASE_SERVER_PORT,
    process: null,
    started: false
  },
  {
    name: 'Message Processor',
    script: path.join(__dirname, 'message-processor', 'index.js'),
    logFile: path.join(logsDir, 'message-processor.log'),
    port: env.PROCESSOR_SERVER_PORT,
    process: null,
    started: false
  },
  {
    name: 'WhatsApp Server',
    script: path.join(__dirname, 'whatsapp-server', 'index.js'),
    logFile: path.join(logsDir, 'whatsapp-server.log'),
    port: env.WHATSAPP_SERVER_PORT,
    process: null,
    started: false
  },
  {
    name: 'API Server',
    script: path.join(__dirname, 'api-server', 'index.js'),
    logFile: path.join(logsDir, 'api-server.log'),
    port: env.API_SERVER_PORT,
    process: null,
    started: false
  }
];

// Función para iniciar un servicio
function startService(service) {
  console.log(`📌 Iniciando ${service.name}...`);
  
  // Crear archivo de log
  const logFile = fs.openSync(service.logFile, 'a');
  
  // Iniciar el proceso
  const proc = spawn('node', [service.script], {
    env: env,
    stdio: ['ignore', logFile, logFile]
  });
  
  // Guardar referencia al proceso
  service.process = proc;
  
  // Manejar eventos del proceso
  proc.on('error', (err) => {
    console.error(`❌ Error iniciando ${service.name}:`, err);
    service.started = false;
  });
  
  proc.on('close', (code) => {
    console.log(`💫 ${service.name} finalizado con código: ${code}`);
    service.started = false;
    
    // Cerrar archivo de log
    fs.closeSync(logFile);
  });
  
  service.started = true;
  console.log(`✅ ${service.name} iniciado en http://localhost:${service.port}`);
  
  // Esperar un poco para que el servicio se inicie completamente
  return new Promise(resolve => setTimeout(resolve, 3000));
}

// Función para detener todos los servicios
function stopAllServices() {
  console.log('⚠️ Deteniendo todos los servicios...');
  
  // Detener servicios en orden inverso
  for (let i = services.length - 1; i >= 0; i--) {
    const service = services[i];
    if (service.process && service.started) {
      console.log(`📌 Deteniendo ${service.name}...`);
      service.process.kill();
    }
  }
  
  console.log('✅ Todos los servicios detenidos.');
}

// Iniciar todos los servicios en orden
async function main() {
  // Verificar base de datos
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: La variable DATABASE_URL no está configurada');
    console.error('Por favor, ejecuta: export DATABASE_URL=tu_url_de_conexion');
    process.exit(1);
  }
  
  console.log('✅ Variables de entorno configuradas');
  
  // Guardar PIDs en un archivo para referencia
  const pidsFile = path.join(__dirname, 'pids.txt');
  
  try {
    // Iniciar cada servicio en orden
    for (const service of services) {
      await startService(service);
    }
    
    console.log('\n✅ ¡Todos los microservicios iniciados correctamente!');
    console.log('  - API Server:        http://localhost:5000');
    console.log('  - WhatsApp Server:   http://localhost:5001');
    console.log('  - Processor Server:  http://localhost:5002');
    console.log('  - Database Server:   http://localhost:5003');
    
    // Guardar PIDs
    const pids = services.map(s => s.process.pid).join(' ');
    fs.writeFileSync(pidsFile, pids);
    console.log(`\n📝 PIDs guardados en ${pidsFile}`);
    console.log(`  - Para detener los servicios: kill $(cat ${pidsFile})`);
    
    // Monitorear procesos
    console.log('\n🔍 Monitoreando servicios en ejecución...');
    console.log('  - Para salir, presiona Ctrl+C');
    console.log(`  - Logs disponibles en ${logsDir}/*.log`);
    
    // Manejar señales para detener servicios
    process.on('SIGINT', () => {
      console.log('\n🛑 Señal de interrupción recibida');
      stopAllServices();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Señal de terminación recibida');
      stopAllServices();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error iniciando microservicios:', error);
    stopAllServices();
    process.exit(1);
  }
}

// Ejecutar el script principal
main();