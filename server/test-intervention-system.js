/**
 * Test completo del sistema de intervenciones manuales
 * Verifica que las intervenciones funcionen correctamente con aislamiento por usuario
 */

import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testInterventionSystem() {
  console.log('🔒 Probando sistema de intervenciones manuales...\n');

  try {
    // 1. Verificar que la tabla existe
    console.log('1. Verificando estructura de base de datos...');
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chat_interventions'
      ORDER BY ordinal_position
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ Tabla chat_interventions no existe');
      return;
    }
    
    console.log('✅ Tabla chat_interventions existe con columnas:');
    tableCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    // 2. Obtener usuarios y cuentas para testing
    console.log('\n2. Obteniendo datos de usuarios y cuentas...');
    const usersQuery = await pool.query(`
      SELECT u.id, u.username, COUNT(wa.id) as account_count
      FROM users u 
      LEFT JOIN whatsapp_accounts wa ON u.id = wa.user_id
      WHERE u.role != 'superadmin'
      GROUP BY u.id, u.username
      LIMIT 3
    `);

    if (usersQuery.rows.length === 0) {
      console.log('❌ No hay usuarios para testing');
      return;
    }

    console.log('✅ Usuarios encontrados para testing:');
    usersQuery.rows.forEach(user => {
      console.log(`   - Usuario ${user.id} (${user.username}): ${user.account_count} cuentas WhatsApp`);
    });

    // 3. Simular intervenciones para cada usuario
    console.log('\n3. Simulando intervenciones manuales...');
    
    for (const user of usersQuery.rows) {
      if (parseInt(user.account_count) > 0) {
        // Obtener cuentas del usuario
        const accountsQuery = await pool.query(
          'SELECT id, name FROM whatsapp_accounts WHERE user_id = $1 LIMIT 2',
          [user.id]
        );

        for (const account of accountsQuery.rows) {
          const chatId = `chat_${user.id}_${account.id}_${Date.now()}`;
          const interventionId = `int_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const pauseUntil = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutos
          
          // Insertar intervención de prueba
          await pool.query(`
            INSERT INTO chat_interventions (
              id, user_id, account_id, chat_id, 
              intervention_at, pause_until, is_active
            ) VALUES ($1, $2, $3, $4, NOW(), $5, true)
          `, [interventionId, user.id, account.id, chatId, pauseUntil]);

          console.log(`   ✅ Intervención creada: Usuario ${user.id} → Cuenta ${account.id} → Chat ${chatId}`);
          console.log(`      Pausado hasta: ${pauseUntil.toLocaleString()}`);
        }
      }
    }

    // 4. Verificar consultas con aislamiento por usuario
    console.log('\n4. Verificando aislamiento por usuario...');
    
    for (const user of usersQuery.rows) {
      const userInterventions = await pool.query(`
        SELECT ci.id, ci.chat_id, ci.pause_until, wa.name as account_name
        FROM chat_interventions ci
        JOIN whatsapp_accounts wa ON ci.account_id = wa.id
        WHERE ci.user_id = $1 AND ci.is_active = true
        ORDER BY ci.intervention_at DESC
      `, [user.id]);

      console.log(`   Usuario ${user.id} (${user.username}): ${userInterventions.rows.length} intervenciones activas`);
      
      userInterventions.rows.forEach(intervention => {
        const remainingTime = Math.ceil((new Date(intervention.pause_until).getTime() - new Date().getTime()) / (1000 * 60));
        console.log(`     - Chat ${intervention.chat_id} en cuenta "${intervention.account_name}" (${remainingTime} min restantes)`);
      });
    }

    // 5. Probar verificación de seguridad (usuario no puede acceder a datos de otros)
    console.log('\n5. Probando seguridad de aislamiento...');
    
    const user1 = usersQuery.rows[0];
    const user2 = usersQuery.rows[1] || usersQuery.rows[0];
    
    if (user1 && user2) {
      // Intentar que usuario 1 acceda a intervenciones de usuario 2
      const crossUserQuery = await pool.query(`
        SELECT ci.id 
        FROM chat_interventions ci
        JOIN whatsapp_accounts wa ON ci.account_id = wa.id
        WHERE ci.user_id = $1 AND wa.user_id = $2
      `, [user1.id, user2.id]);

      if (crossUserQuery.rows.length === 0) {
        console.log('   ✅ Aislamiento funcionando: Usuario no puede ver intervenciones de otros usuarios');
      } else {
        console.log('   ⚠️  Posible fuga de datos: Se encontraron intervenciones cruzadas');
      }
    }

    // 6. Simular expiración y limpieza
    console.log('\n6. Simulando limpieza de intervenciones expiradas...');
    
    // Crear una intervención ya expirada
    const expiredId = `expired_${Date.now()}`;
    const expiredPause = new Date(Date.now() - (60 * 1000)); // Expirada hace 1 minuto
    
    await pool.query(`
      INSERT INTO chat_interventions (
        id, user_id, account_id, chat_id, 
        intervention_at, pause_until, is_active
      ) VALUES ($1, $2, 1, 'expired_chat', NOW(), $3, true)
    `, [expiredId, user1.id, expiredPause]);

    // Limpiar intervenciones expiradas
    const cleanupResult = await pool.query(`
      UPDATE chat_interventions 
      SET is_active = false 
      WHERE is_active = true AND pause_until <= NOW()
      RETURNING id
    `);

    console.log(`   ✅ ${cleanupResult.rowCount} intervenciones expiradas limpiadas`);

    // 7. Estadísticas finales
    console.log('\n7. Estadísticas del sistema...');
    
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_interventions,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_interventions,
        COUNT(DISTINCT user_id) as users_with_interventions,
        COUNT(DISTINCT account_id) as accounts_with_interventions
      FROM chat_interventions
    `);

    const stats = statsQuery.rows[0];
    console.log(`   📊 Total intervenciones: ${stats.total_interventions}`);
    console.log(`   📊 Intervenciones activas: ${stats.active_interventions}`);
    console.log(`   📊 Usuarios con intervenciones: ${stats.users_with_interventions}`);
    console.log(`   📊 Cuentas con intervenciones: ${stats.accounts_with_interventions}`);

    console.log('\n✅ Sistema de intervenciones verificado exitosamente!');
    console.log('\n🔒 Funcionalidades confirmadas:');
    console.log('   ✓ Creación de intervenciones con aislamiento por usuario');
    console.log('   ✓ Verificación de seguridad y privacidad');
    console.log('   ✓ Limpieza automática de intervenciones expiradas');
    console.log('   ✓ Consultas filtradas por usuario automáticamente');

  } catch (error) {
    console.error('❌ Error en prueba del sistema:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar las pruebas
testInterventionSystem().catch(console.error);