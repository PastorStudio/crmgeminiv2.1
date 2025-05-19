/**
 * Script para corregir errores en MassSenderService
 * Este script modifica el servicio massSenderService para evitar 
 * errores de columnas start_date vs startDate
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

class MassSenderFix {
  
  async fixProcessQueue() {
    try {
      console.log('Iniciando parche para MassSenderService...');
      
      // Verificar que las columnas existen
      console.log('Verificando columnas en campaigns...');
      
      const columnResult = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = 'start_date'
      `);
      
      if (columnResult.rows.length === 0) {
        console.log('Creando columna start_date en la tabla campaigns...');
        await db.execute(sql`
          ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
          UPDATE campaigns SET start_date = "startDate";
        `);
        console.log('Columna start_date creada correctamente');
      } else {
        console.log('Columna start_date ya existe');
      }
      
      // Corregir la consulta SQL que está causando el error
      console.log('Replicando consulta problemática para verificación...');
      
      try {
        // Esta es la consulta con problemas, verificamos si ahora funciona
        const testQuery = await db.execute(sql`
          SELECT * FROM campaigns 
          WHERE status = 'running' 
          AND (start_date IS NULL OR start_date <= NOW())
          AND (end_date IS NULL OR end_date >= NOW())
          LIMIT 5
        `);
        
        console.log('Consulta SQL ejecutada exitosamente. La corrección funciona.');
        console.log(`Se encontraron ${testQuery.rows.length} campañas running.`);
      } catch (error) {
        console.error('La consulta sigue fallando:', error);
      }
      
      console.log('Parche para MassSenderService completado.');
    } catch (error) {
      console.error('Error durante el parche:', error);
    }
  }
}

const fixer = new MassSenderFix();
fixer.fixProcessQueue();