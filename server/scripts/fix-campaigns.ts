/**
 * Script específico para corregir la tabla campaigns
 * Este script soluciona el problema de columnas faltantes en la tabla campaigns
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Iniciando correcciones para la tabla campaigns...');

    // Verificar si la tabla campaigns existe
    const campaignsTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'campaigns'
      );
    `);
    
    const campaignsExists = campaignsTableExists.rows && campaignsTableExists.rows[0] && campaignsTableExists.rows[0].exists;
    
    if (!campaignsExists) {
      // Crear la tabla campaigns con todas las columnas necesarias
      console.log('Tabla campaigns no existe. Creándola...');
      await db.execute(sql`
        CREATE TABLE campaigns (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'draft',
          "startDate" TIMESTAMP,
          "endDate" TIMESTAMP,
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          budget NUMERIC,
          results TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP,
          updated_at TIMESTAMP,
          "createdBy" INTEGER,
          created_by INTEGER,
          "templateId" INTEGER,
          template_id INTEGER
        );
      `);
      console.log('Tabla campaigns creada correctamente.');
    } else {
      // La tabla existe, verificar y añadir las columnas faltantes
      console.log('Tabla campaigns existe. Verificando columnas...');
      
      // Verificar columna start_date
      const startDateExists = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'start_date'
      `);
      
      if (startDateExists.rows.length === 0) {
        console.log('Agregando columna start_date...');
        await db.execute(sql`
          ALTER TABLE campaigns ADD COLUMN start_date TIMESTAMP;
          UPDATE campaigns SET start_date = "startDate";
        `);
        console.log('Columna start_date agregada correctamente.');
      }
      
      // Verificar columna end_date
      const endDateExists = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'end_date'
      `);
      
      if (endDateExists.rows.length === 0) {
        console.log('Agregando columna end_date...');
        await db.execute(sql`
          ALTER TABLE campaigns ADD COLUMN end_date TIMESTAMP;
          UPDATE campaigns SET end_date = "endDate";
        `);
        console.log('Columna end_date agregada correctamente.');
      }
      
      // Verificar columna created_at
      const createdAtExists = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'created_at'
      `);
      
      if (createdAtExists.rows.length === 0) {
        console.log('Agregando columna created_at...');
        await db.execute(sql`
          ALTER TABLE campaigns ADD COLUMN created_at TIMESTAMP;
          UPDATE campaigns SET created_at = "createdAt";
        `);
        console.log('Columna created_at agregada correctamente.');
      }
      
      // Verificar columna updated_at
      const updatedAtExists = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'updated_at'
      `);
      
      if (updatedAtExists.rows.length === 0) {
        console.log('Agregando columna updated_at...');
        await db.execute(sql`
          ALTER TABLE campaigns ADD COLUMN updated_at TIMESTAMP;
          UPDATE campaigns SET updated_at = "updatedAt";
        `);
        console.log('Columna updated_at agregada correctamente.');
      }
      
      // Verificar columna created_by
      const createdByExists = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'created_by'
      `);
      
      if (createdByExists.rows.length === 0) {
        console.log('Agregando columna created_by...');
        await db.execute(sql`
          ALTER TABLE campaigns ADD COLUMN created_by INTEGER;
          UPDATE campaigns SET created_by = "createdBy";
        `);
        console.log('Columna created_by agregada correctamente.');
      }
      
      // Verificar columna template_id
      const templateIdExists = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'template_id'
      `);
      
      if (templateIdExists.rows.length === 0) {
        console.log('Agregando columna template_id...');
        await db.execute(sql`
          ALTER TABLE campaigns ADD COLUMN template_id INTEGER;
          UPDATE campaigns SET template_id = "templateId";
        `);
        console.log('Columna template_id agregada correctamente.');
      }
    }
    
    // Verificar si la tabla whatsapp_accounts existe
    const whatsappTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'whatsapp_accounts'
      );
    `);
    
    const whatsappExists = whatsappTableExists.rows && whatsappTableExists.rows[0] && whatsappTableExists.rows[0].exists;
    
    if (whatsappExists) {
      // Verificar columna session_data
      const sessionDataExists = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_accounts' AND column_name = 'session_data'
      `);
      
      if (sessionDataExists.rows.length === 0) {
        console.log('Agregando columna session_data a whatsapp_accounts...');
        
        // Verificar si sessionData existe primero
        const sessionDataCamelExists = await db.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'whatsapp_accounts' AND column_name = 'sessionData'
        `);
        
        if (sessionDataCamelExists.rows.length > 0) {
          // sessionData existe, agregar session_data como un alias
          await db.execute(sql`
            ALTER TABLE whatsapp_accounts ADD COLUMN session_data TEXT;
            UPDATE whatsapp_accounts SET session_data = "sessionData";
          `);
        } else {
          // Ninguna de las dos columnas existe, agregar ambas
          await db.execute(sql`
            ALTER TABLE whatsapp_accounts ADD COLUMN "sessionData" TEXT;
            ALTER TABLE whatsapp_accounts ADD COLUMN session_data TEXT;
          `);
        }
        console.log('Columna session_data agregada correctamente a whatsapp_accounts.');
      }
    }

    console.log('Correcciones completadas exitosamente.');
  } catch (error) {
    console.error('Error durante las correcciones:', error);
  }
}

main();