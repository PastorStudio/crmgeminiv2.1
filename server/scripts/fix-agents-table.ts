/**
 * Script para crear la tabla agents si no existe
 * Este script garantiza que la tabla agents exista con todos los campos necesarios
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function createAgentsTable() {
  try {
    console.log('Verificando si existe la tabla agents...');
    
    // Primero verificamos si la tabla ya existe
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'agents'
      );
    `);
    
    const exists = tableExists.rows && tableExists.rows[0] && tableExists.rows[0].exists === true;
    
    if (!exists) {
      console.log('La tabla agents no existe. Creando tabla...');
      
      // Crear la tabla agents con todos los campos necesarios
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS agents (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          avatar TEXT,
          department TEXT,
          phone TEXT,
          role TEXT DEFAULT 'agent',
          bio TEXT,
          skills TEXT,
          performance_metrics TEXT,
          supervisor_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          hire_date TIMESTAMP,
          workload INTEGER DEFAULT 0,
          availability TEXT DEFAULT 'available',
          last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('Tabla agents creada exitosamente.');
      
      // Insertar datos de ejemplo
      console.log('Insertando agentes de ejemplo...');
      await db.execute(sql`
        INSERT INTO agents (name, email, status, department, role)
        VALUES 
          ('Juan Pérez', 'juan@geminicrm.com', 'active', 'Ventas', 'agent'),
          ('Ana García', 'ana@geminicrm.com', 'active', 'Soporte', 'agent'),
          ('Carlos Rodríguez', 'carlos@geminicrm.com', 'active', 'Marketing', 'supervisor');
      `);
      
      console.log('Datos de ejemplo insertados exitosamente.');
    } else {
      console.log('La tabla agents ya existe.');
      
      // Verificar si tiene la columna workload
      const hasWorkload = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'agents' AND column_name = 'workload'
        );
      `);
      
      const workloadExists = hasWorkload.rows && hasWorkload.rows[0] && hasWorkload.rows[0].exists === true;
      
      if (!workloadExists) {
        console.log('Añadiendo columna workload...');
        await db.execute(sql`ALTER TABLE agents ADD COLUMN workload INTEGER DEFAULT 0;`);
      }
      
      // Verificar si tiene la columna availability
      const hasAvailability = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'agents' AND column_name = 'availability'
        );
      `);
      
      const availabilityExists = hasAvailability.rows && hasAvailability.rows[0] && hasAvailability.rows[0].exists === true;
      
      if (!availabilityExists) {
        console.log('Añadiendo columna availability...');
        await db.execute(sql`ALTER TABLE agents ADD COLUMN availability TEXT DEFAULT 'available';`);
      }
      
      // Verificar registros
      const countResult = await db.execute(sql`SELECT COUNT(*) FROM agents;`);
      const count = parseInt(countResult.rows[0].count);
      
      if (count === 0) {
        console.log('No hay agentes en la tabla. Insertando agentes de ejemplo...');
        await db.execute(sql`
          INSERT INTO agents (name, email, status, department, role)
          VALUES 
            ('Juan Pérez', 'juan@geminicrm.com', 'active', 'Ventas', 'agent'),
            ('Ana García', 'ana@geminicrm.com', 'active', 'Soporte', 'agent'),
            ('Carlos Rodríguez', 'carlos@geminicrm.com', 'active', 'Marketing', 'supervisor');
        `);
        console.log('Datos de ejemplo insertados exitosamente.');
      } else {
        console.log(`La tabla agents ya contiene ${count} registros.`);
      }
    }
    
    console.log('Verificación y corrección de la tabla agents completada exitosamente.');
  } catch (error) {
    console.error('Error al verificar/crear la tabla agents:', error);
  }
}

// Ejecutar la función
createAgentsTable()
  .then(() => {
    console.log('Proceso completado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error en el proceso:', error);
    process.exit(1);
  });