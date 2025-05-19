/**
 * Script para corregir problemas en la estructura de la base de datos
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Iniciando correcciones de la base de datos...');

    // Corregir problema de full_name vs fullName en users
    console.log('Verificando columna full_name en tabla users...');
    const fullNameResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'full_name'
    `);

    if (fullNameResult.rows && fullNameResult.rows.length > 0) {
      console.log('Encontrada columna full_name, renombrando a fullName...');
      await db.execute(sql`
        ALTER TABLE users RENAME COLUMN full_name TO "fullName"
      `);
      console.log('Columna renombrada correctamente.');
    } else {
      console.log('Verificando si fullName ya existe...');
      const fullNameExistsResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'fullName'
      `);
      
      if (fullNameExistsResult.rows && fullNameExistsResult.rows.length > 0) {
        console.log('La columna fullName ya existe correctamente.');
      } else {
        console.log('Creando columna fullName...');
        await db.execute(sql`
          ALTER TABLE users ADD COLUMN "fullName" text
        `);
        console.log('Columna fullName creada correctamente.');
      }
    }

    // Corregir problema de phone_number en whatsapp_accounts
    console.log('Verificando columna phone_number en tabla whatsapp_accounts...');
    const phoneResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'whatsapp_accounts' AND column_name = 'phone_number'
    `);

    if (phoneResult.rows && phoneResult.rows.length === 0) {
      console.log('Columna phone_number no encontrada, verificando phoneNumber...');
      const phoneNumberResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_accounts' AND column_name = 'phoneNumber'
      `);
      
      if (phoneNumberResult.rows && phoneNumberResult.rows.length > 0) {
        console.log('Columna phoneNumber existe, creando alias phone_number...');
        await db.execute(sql`
          ALTER TABLE whatsapp_accounts ADD COLUMN phone_number text GENERATED ALWAYS AS ("phoneNumber") STORED
        `);
        console.log('Alias phone_number creado correctamente.');
      } else {
        console.log('No se encontró ninguna columna de teléfono. Verificando si la tabla existe...');
        const tableExists = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'whatsapp_accounts'
          );
        `);
        
        const exists = tableExists.rows && tableExists.rows[0] && tableExists.rows[0].exists;
        
        if (exists) {
          console.log('Tabla whatsapp_accounts existe, creando columnas necesarias...');
          try {
            await db.execute(sql`
              ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS "phoneNumber" text;
              ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS phone_number text;
            `);
            console.log('Columnas añadidas correctamente.');
          } catch (err) {
            console.error('Error al crear columnas:', err);
          }
        } else {
          console.log('Tabla whatsapp_accounts no existe. Creándola...');
          try {
            await db.execute(sql`
              CREATE TABLE IF NOT EXISTS whatsapp_accounts (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                "phoneNumber" TEXT NOT NULL,
                phone_number TEXT,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              );
            `);
            console.log('Tabla whatsapp_accounts creada correctamente.');
          } catch (err) {
            console.error('Error al crear tabla:', err);
          }
        }
      }
    } else {
      console.log('Columna phone_number ya existe correctamente.');
    }

    // Crear tabla campaigns si no existe
    console.log('Verificando tabla campaigns...');
    const campaignsTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'campaigns'
      );
    `);
    
    const campaignsExists = campaignsTableExists.rows && campaignsTableExists.rows[0] && campaignsTableExists.rows[0].exists;
    
    if (!campaignsExists) {
      console.log('Tabla campaigns no existe. Creándola...');
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS campaigns (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'draft',
            "startDate" TIMESTAMP,
            "endDate" TIMESTAMP,
            budget NUMERIC,
            results TEXT,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "createdBy" INTEGER,
            "templateId" INTEGER
          );
        `);
        console.log('Tabla campaigns creada correctamente.');
      } catch (err) {
        console.error('Error al crear tabla campaigns:', err);
      }
    } else {
      console.log('Tabla campaigns ya existe correctamente.');
    }

    console.log('Correcciones de base de datos completadas.');
  } catch (error) {
    console.error('Error durante la corrección de la base de datos:', error);
  } finally {
    // No cerramos la conexión aquí para permitir que el servidor siga usando la misma
    console.log('Script de corrección finalizado.');
  }
}

main();