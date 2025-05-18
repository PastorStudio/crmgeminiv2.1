/**
 * Script para probar la API de detección de citas
 * Este archivo proporciona funciones para probar manualmente la detección de citas
 */

import { createTestAppointment } from './services/testScript';

// Este módulo puede ser importado y utilizado directamente en la consola de Node.js para testing manual:
// 
// Ejemplo de uso:
// 1. Abrir una consola Node.js
// 2. Ejecutar:
//    const apiTest = require('./api-test');
//    apiTest.testCreateAppointment(1);  // Donde 1 es el ID del lead

export async function testCreateAppointment(leadId: number): Promise<void> {
  console.log('=== Iniciando prueba de creación de cita ===');
  try {
    const success = await createTestAppointment(leadId);
    if (success) {
      console.log('✅ Prueba completada con éxito');
    } else {
      console.error('❌ La prueba falló, no se pudo crear la cita');
    }
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
  console.log('=== Fin de la prueba ===');
}

// Si se ejecuta directamente este archivo
if (typeof require !== 'undefined' && require.main === module) {
  const leadId = process.argv[2] ? parseInt(process.argv[2]) : 1;
  testCreateAppointment(leadId)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal:', err);
      process.exit(1);
    });
}

// Exportar por defecto para uso con import
export default {
  testCreateAppointment
};