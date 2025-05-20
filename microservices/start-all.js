/**
 * Script para iniciar todos los microservicios
 * Inicia los 4 servidores en orden: base de datos, mensajería, WhatsApp, y API
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuración
const SERVICES = [
  {
    name: 'Database Server',
    directory: 'database-server',
    script: 'index.js',
    port: 5003,
    env: { DATABASE_SERVER_PORT: 5003 }
  },
  {
    name: 'Message Processor',
    directory: 'message-processor',
    script: 'index.js',
    port: 5002,
    env: { PROCESSOR_SERVER_PORT: 5002 }
  },
  {
    name: 'WhatsApp Server',
    directory: 'whatsapp-server',
    script: 'index.js',
    port: 5001,
    env: { WHATSAPP_SERVER_PORT: 5001 }
  },
  {
    name: 'API Server',
    directory: 'api-server',
    script: 'index.js',
    port: 5000,
    env: { API_SERVER_PORT: 5000 }
  }
];

// Variables de entorno comunes
const BASE_ENV = {
  DATABASE_URL: process.env.DATABASE_URL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  NODE_ENV: 'development'
};

// Procesos activos
const processes = {};

// Verifica si cada servicio tiene su archivo principal
function validateServices() {
  let valid = true;
  
  for (const service of SERVICES) {
    const scriptPath = path.join(__dirname, service.directory, service.script);
    
    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Error: No se encontró el archivo ${scriptPath}`);
      valid = false;
    }
  }
  
  return valid;
}

// Inicia un servicio
function startService(service) {
  return new Promise((resolve) => {
    console.log(`🚀 Iniciando ${service.name} en puerto ${service.port}...`);
    
    // Combinar variables de entorno
    const env = { ...process.env, ...BASE_ENV, ...service.env };
    
    // Iniciar proceso
    const proc = spawn('node', [service.script], {
      cwd: path.join(__dirname, service.directory),
      env: env,
      stdio: 'pipe'
    });
    
    // Guardar referencia
    processes[service.name] = proc;
    
    // Manejar salida
    proc.stdout.on('data', (data) => {
      console.log(`[${service.name}] ${data.toString().trim()}`);
    });
    
    proc.stderr.on('data', (data) => {
      console.error(`[${service.name}] ERROR: ${data.toString().trim()}`);
    });
    
    // Manejar finalización
    proc.on('close', (code) => {
      console.log(`⚠️ ${service.name} se detuvo con código: ${code}`);
      delete processes[service.name];
      
      // Reiniciar servicio tras un breve retraso
      setTimeout(() => {
        console.log(`⚙️ Reiniciando ${service.name}...`);
        startService(service);
      }, 5000);
    });
    
    // Esperar un momento antes de iniciar el siguiente servicio
    setTimeout(() => {
      console.log(`✅ ${service.name} iniciado.`);
      resolve();
    }, 3000);
  });
}

// Detener todos los servicios
function stopAllServices() {
  console.log('\n🛑 Deteniendo todos los servicios...');
  
  for (const [name, proc] of Object.entries(processes)) {
    console.log(`⏹️ Deteniendo ${name}...`);
    proc.kill();
  }
}

// Función principal
async function main() {
  console.log('🔍 Verificando servicios...');
  
  if (!validateServices()) {
    console.error('❌ Error: Algunos servicios no están disponibles.');
    process.exit(1);
  }
  
  console.log('✅ Todos los servicios están disponibles.');
  
  // Iniciar servicios en secuencia (orden importante)
  for (const service of SERVICES) {
    await startService(service);
  }
  
  console.log('\n🎉 Todos los servicios iniciados correctamente.');
  console.log('📊 Sistema distribuido funcionando en los siguientes puertos:');
  SERVICES.forEach(service => {
    console.log(`  - ${service.name}: http://localhost:${service.port}`);
  });
  console.log('\n💻 Panel de administración: http://localhost:5000');
  console.log('⚠️ Presiona Ctrl+C para detener todos los servicios');
}

// Manejar terminación
process.on('SIGINT', () => {
  stopAllServices();
  setTimeout(() => process.exit(0), 1000);
});

// Ejecutar
main().catch(err => {
  console.error('❌ Error iniciando servicios:', err);
  stopAllServices();
  process.exit(1);
});