/**
 * Script unificado para iniciar el sistema de microservicios de WhatsApp
 * 
 * Este script inicia los cuatro microservicios en orden:
 * 1. Servidor de base de datos (puerto 5003)
 * 2. Servidor de WhatsApp (puerto 5001)
 * 3. Servidor de procesamiento de mensajes (puerto 5002)
 * 4. Servidor API (puerto 5000)
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de servicios
const services = [
  {
    name: 'database-server',
    command: 'node',
    args: ['microservices/database-server/index.js'],
    env: { DATABASE_SERVER_PORT: '5003' },
    ready: (output) => output.includes('Servidor de Base de Datos iniciado')
  },
  {
    name: 'whatsapp-server',
    command: 'node',
    args: ['microservices/whatsapp-server/index.js'],
    env: { WHATSAPP_SERVER_PORT: '5001' },
    ready: (output) => output.includes('Servidor de WhatsApp iniciado')
  },
  {
    name: 'message-processor',
    command: 'node',
    args: ['microservices/message-processor/index.js'],
    env: { PROCESSOR_SERVER_PORT: '5002' },
    ready: (output) => output.includes('Servidor de Procesamiento iniciado')
  },
  {
    name: 'api-server',
    command: 'node',
    args: ['microservices/api-server/index.js'],
    env: { API_SERVER_PORT: '5000' },
    ready: (output) => output.includes('Servidor API iniciado')
  }
];

// Variables para seguimiento de procesos
const processes = {};
const readyStates = {};
let shuttingDown = false;

// Función para iniciar un servicio
function startService(service) {
  return new Promise((resolve) => {
    console.log(`\n🚀 Iniciando servicio: ${service.name}...`);
    
    // Crear proceso con las variables de entorno adecuadas
    const env = { ...process.env, ...service.env };
    const proc = spawn(service.command, service.args, { 
      env,
      cwd: __dirname,
      shell: true
    });
    
    // Almacenar proceso
    processes[service.name] = proc;
    readyStates[service.name] = false;
    
    // Configurar captura de salida
    let output = '';
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(`[${service.name}] ${text}`);
      
      // Verificar si el servicio está listo
      if (!readyStates[service.name] && service.ready(output)) {
        readyStates[service.name] = true;
        console.log(`✅ Servicio ${service.name} iniciado correctamente`);
        resolve(true);
      }
    });
    
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(`[${service.name}][ERROR] ${text}`);
    });
    
    proc.on('error', (error) => {
      console.error(`❌ Error al iniciar servicio ${service.name}:`, error);
      if (!readyStates[service.name]) {
        readyStates[service.name] = false;
        resolve(false);
      }
    });
    
    proc.on('close', (code) => {
      if (!shuttingDown) {
        console.log(`⚠️ Servicio ${service.name} cerrado con código ${code}`);
        delete processes[service.name];
        
        // Reiniciar servicio si no estamos cerrando
        setTimeout(() => {
          console.log(`🔄 Reiniciando servicio ${service.name}...`);
          startService(service);
        }, 5000);
      }
    });
    
    // Si después de 20 segundos no está listo, considerar un timeout
    setTimeout(() => {
      if (!readyStates[service.name]) {
        console.error(`⏱️ Timeout al iniciar servicio ${service.name}`);
        readyStates[service.name] = false;
        resolve(false);
      }
    }, 20000);
  });
}

// Función para detener todos los servicios
function stopAllServices() {
  return new Promise((resolve) => {
    console.log('\n📴 Deteniendo todos los servicios...');
    shuttingDown = true;
    
    // Detener todos los procesos en orden inverso
    const serviceNames = Object.keys(processes);
    
    if (serviceNames.length === 0) {
      console.log('No hay servicios en ejecución');
      resolve();
      return;
    }
    
    // Utilizar un enfoque secuencial para detener los servicios
    let index = serviceNames.length - 1;
    
    function stopNextService() {
      if (index < 0) {
        console.log('Todos los servicios detenidos');
        resolve();
        return;
      }
      
      const serviceName = serviceNames[index--];
      const proc = processes[serviceName];
      
      if (proc) {
        console.log(`Deteniendo servicio: ${serviceName}...`);
        
        // En sistemas Unix, enviar SIGTERM
        if (proc.kill) {
          proc.kill('SIGTERM');
        }
        
        setTimeout(stopNextService, 1000);
      } else {
        stopNextService();
      }
    }
    
    stopNextService();
  });
}

// Función principal
async function main() {
  console.log('🌟 Iniciando sistema de microservicios...');
  
  // Manejar señales de cierre
  process.on('SIGINT', async () => {
    console.log('\n⛔ Señal de interrupción recibida');
    await stopAllServices();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n⛔ Señal de terminación recibida');
    await stopAllServices();
    process.exit(0);
  });
  
  // Iniciar servicios en orden
  for (const service of services) {
    const success = await startService(service);
    
    if (!success) {
      console.error(`❌ No se pudo iniciar el servicio ${service.name}. Deteniendo todos los servicios...`);
      await stopAllServices();
      process.exit(1);
    }
    
    // Esperar un poco entre inicios de servicios
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✨ Todos los servicios iniciados correctamente');
  console.log('\n📡 Sistema disponible en http://localhost:5000');
  console.log('\n💡 Presiona Ctrl+C para detener todos los servicios');
}

// Iniciar el sistema
main().catch((error) => {
  console.error('❌ Error al iniciar el sistema:', error);
  stopAllServices().then(() => {
    process.exit(1);
  });
});