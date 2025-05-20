/**
 * Script para corregir específicamente el problema de columna full_name vs fullName
 * en todas las consultas SQL de la aplicación
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function fixUsersColumnIssue() {
  try {
    console.log('Iniciando corrección para el problema de full_name vs fullName...');
    
    // Verificar si la columna full_name existe
    const fullNameResult = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'full_name'
    `);
    
    if (fullNameResult.rows && fullNameResult.rows.length > 0) {
      console.log('Columna full_name encontrada, renombrando a fullName...');
      await db.execute(sql`
        ALTER TABLE users RENAME COLUMN full_name TO "fullName"
      `);
      console.log('Columna renombrada correctamente.');
    } else {
      // Verificar si fullName ya existe
      const fullNameExistsResult = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'fullName'
      `);
      
      if (fullNameExistsResult.rows && fullNameExistsResult.rows.length > 0) {
        console.log('La columna fullName ya existe.');
        
        // Verificar si tiene datos
        const hasDataResult = await db.execute(sql`
          SELECT COUNT(*) FROM users WHERE "fullName" IS NOT NULL
        `);
        
        const hasData = hasDataResult.rows[0] && parseInt(hasDataResult.rows[0].count) > 0;
        
        if (!hasData) {
          console.log('La columna fullName no tiene datos. Actualizando valores...');
          
          // Actualizar los valores desde el nombre de usuario como fallback
          await db.execute(sql`
            UPDATE users SET "fullName" = username WHERE "fullName" IS NULL
          `);
          console.log('Valores de fullName actualizados correctamente.');
        }
      } else {
        console.log('Ninguna columna (full_name o fullName) encontrada. Creando columna fullName...');
        await db.execute(sql`
          ALTER TABLE users ADD COLUMN "fullName" TEXT;
          UPDATE users SET "fullName" = username WHERE "fullName" IS NULL
        `);
        console.log('Columna fullName creada y poblada correctamente.');
      }
    }
    
    // Crear una vista para compatibilidad con código que use full_name
    console.log('Creando vista v_users para compatibilidad con código que use full_name...');
    try {
      await db.execute(sql`
        CREATE OR REPLACE VIEW v_users AS
        SELECT *, "fullName" as full_name FROM users
      `);
      console.log('Vista v_users creada correctamente.');
    } catch (e) {
      console.error('Error al crear vista:', e);
    }
    
    console.log('Corrección para full_name vs fullName completada.');
  } catch (error) {
    console.error('Error durante la corrección:', error);
  }
}

fixUsersColumnIssue();