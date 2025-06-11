import { db } from '../db';
import { whatsappAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Migra las cuentas existentes al sistema de offset por usuario
 * Usuario 1: cuentas 10-19, Usuario 2: cuentas 20-29, Usuario 3: cuentas 30-39, etc.
 */
export async function migrateUserAccounts() {
  console.log('🔄 Iniciando migración de cuentas a sistema de offset por usuario...');
  
  try {
    // Obtener todas las cuentas existentes
    const existingAccounts = await db.select().from(whatsappAccounts).orderBy(whatsappAccounts.id);
    
    console.log(`📊 Encontradas ${existingAccounts.length} cuentas para migrar`);
    
    // Agrupar cuentas por usuario
    const accountsByUser = new Map();
    
    for (const account of existingAccounts) {
      const userId = account.userId || 3; // Default a usuario 3 si no tiene user_id
      if (!accountsByUser.has(userId)) {
        accountsByUser.set(userId, []);
      }
      accountsByUser.get(userId).push(account);
    }
    
    // Migrar cada grupo de usuario
    for (const [userId, userAccounts] of accountsByUser.entries()) {
      const userOffset = userId * 10;
      console.log(`🔄 Migrando ${userAccounts.length} cuentas del usuario ${userId} al rango ${userOffset}-${userOffset + 9}`);
      
      // Asignar nuevos IDs a las cuentas del usuario
      for (let i = 0; i < userAccounts.length; i++) {
        const account = userAccounts[i];
        const newId = userOffset + i;
        
        if (account.id !== newId) {
          console.log(`🔄 Migrando cuenta "${account.name}" de ID ${account.id} a ID ${newId}`);
          
          // Actualizar el ID de la cuenta
          await db.update(whatsappAccounts)
            .set({ 
              id: newId,
              userId: userId // Asegurar que el userId esté correcto
            })
            .where(eq(whatsappAccounts.id, account.id));
        } else {
          // Solo asegurar que el userId esté correcto
          await db.update(whatsappAccounts)
            .set({ userId: userId })
            .where(eq(whatsappAccounts.id, account.id));
        }
      }
    }
    
    console.log('✅ Migración de cuentas completada exitosamente');
    
    // Mostrar resultado final
    const migratedAccounts = await db.select().from(whatsappAccounts).orderBy(whatsappAccounts.userId, whatsappAccounts.id);
    console.log('📊 Cuentas después de la migración:');
    for (const account of migratedAccounts) {
      console.log(`  - Usuario ${account.userId}: Cuenta ${account.id} (${account.name})`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

// Ejecutar migración si es llamado directamente
if (require.main === module) {
  migrateUserAccounts()
    .then(() => {
      console.log('✅ Migración completada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en migración:', error);
      process.exit(1);
    });
}