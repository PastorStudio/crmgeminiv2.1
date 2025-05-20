/**
 * Script para iniciar todos los microservicios
 * 
 * Este script inicia todos los servicios en orden:
 * 1. Servidor de base de datos (puerto 5003)
 * 2. Servidor de WhatsApp (puerto 5001)
 * 3. Servidor de procesamiento de mensajes (puerto 5002) 
 * 4. Servidor API (puerto 5000)
 */

console.log('Iniciando microservicios para el sistema de integración WhatsApp...');
console.log('Presiona Ctrl+C para detener todos los servicios');

// Ejecutar start-microservices.js usando el node actual
require('./start-microservices.js');