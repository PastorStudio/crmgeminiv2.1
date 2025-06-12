/**
 * Demo User Maintenance Tools
 * Utilities to maintain consistency in demo user durations
 */

import { db } from '../db';
import { demoUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { DEMO_DURATION_MS } from './demoConstants';

/**
 * Fixes all demo users to have exactly 72 hours duration
 * @returns Number of users corrected
 */
export async function fixAllDemoDurations(): Promise<number> {
  try {
    console.log('🔧 Iniciando corrección masiva de duraciones de demo...');

    // Find all demos with incorrect duration
    const incorrectDemos = await db.execute(
      `SELECT id, username, created_at, expires_at 
       FROM demo_users 
       WHERE status = 'active' 
       AND EXTRACT(EPOCH FROM (expires_at - created_at)) / (3600 * 24) != 3.0`
    );

    console.log(`🔍 Encontrados ${incorrectDemos.rows.length} demos con duración incorrecta`);

    let correctedCount = 0;

    for (const demo of incorrectDemos.rows) {
      const newExpiresAt = new Date(new Date(demo.created_at).getTime() + DEMO_DURATION_MS);
      
      await db.execute(
        `UPDATE demo_users 
         SET expires_at = $1, updated_at = NOW() 
         WHERE id = $2`,
        [newExpiresAt, demo.id]
      );

      console.log(`✅ Corregido demo: ${demo.username} - Nueva expiración: ${newExpiresAt.toISOString()}`);
      correctedCount++;
    }

    console.log(`✅ Corrección masiva completada: ${correctedCount} demos corregidos`);
    return correctedCount;

  } catch (error) {
    console.error('❌ Error en corrección masiva de demos:', error);
    return 0;
  }
}

/**
 * Validates all demo users have correct 72-hour duration
 * @returns Validation report
 */
export async function validateDemoDurations(): Promise<{
  totalDemos: number;
  correctDuration: number;
  incorrectDuration: number;
  isValid: boolean;
}> {
  try {
    const result = await db.execute(
      `SELECT COUNT(*) as total_demos,
              COUNT(CASE WHEN EXTRACT(EPOCH FROM (expires_at - created_at)) / (3600 * 24) = 3.0 THEN 1 END) as correct_duration,
              COUNT(CASE WHEN EXTRACT(EPOCH FROM (expires_at - created_at)) / (3600 * 24) != 3.0 THEN 1 END) as incorrect_duration
       FROM demo_users 
       WHERE status = 'active'`
    );

    const stats = result.rows[0];
    
    return {
      totalDemos: parseInt(stats.total_demos),
      correctDuration: parseInt(stats.correct_duration),
      incorrectDuration: parseInt(stats.incorrect_duration),
      isValid: parseInt(stats.incorrect_duration) === 0
    };
  } catch (error) {
    console.error('❌ Error validando duraciones de demo:', error);
    return {
      totalDemos: 0,
      correctDuration: 0,
      incorrectDuration: 0,
      isValid: false
    };
  }
}

/**
 * Periodic maintenance function to ensure all demos maintain 72-hour duration
 */
export async function performDemoMaintenance(): Promise<void> {
  console.log('🔄 Ejecutando mantenimiento de usuarios demo...');

  const validation = await validateDemoDurations();
  console.log(`📊 Estado actual: ${validation.correctDuration}/${validation.totalDemos} demos con duración correcta`);

  if (!validation.isValid) {
    console.log(`⚠️ Detectadas ${validation.incorrectDuration} duraciones incorrectas. Corrigiendo...`);
    const corrected = await fixAllDemoDurations();
    console.log(`✅ Mantenimiento completado: ${corrected} demos corregidos`);
  } else {
    console.log('✅ Todos los demos tienen duración correcta (72 horas)');
  }
}

/**
 * Starts periodic maintenance every 6 hours
 */
export function startDemoMaintenanceScheduler(): void {
  console.log('🕐 Iniciando programador de mantenimiento de demos (cada 6 horas)...');
  
  // Execute immediate maintenance
  performDemoMaintenance();
  
  // Schedule maintenance every 6 hours
  setInterval(() => {
    performDemoMaintenance();
  }, 6 * 60 * 60 * 1000); // 6 hours
}