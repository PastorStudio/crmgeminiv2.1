/**
 * Script para corregir la tabla tickets y añadir la columna de asignación a agentes
 * Este script garantiza que la tabla tickets exista y tenga todas las columnas necesarias
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function fixTicketsTable() {
  try {
    console.log('Verificando si existe la tabla tickets...');
    
    // Primero verificamos si la tabla ya existe
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tickets'
      );
    `);
    
    const exists = tableExists.rows && tableExists.rows[0] && tableExists.rows[0].exists === true;
    
    if (!exists) {
      console.log('La tabla tickets no existe. Creando tabla...');
      
      // Crear la tabla tickets con todos los campos necesarios
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tickets (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'abierto',
          priority TEXT DEFAULT 'media',
          assigned_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          due_date TIMESTAMP,
          category TEXT,
          tags TEXT,
          attachments TEXT,
          notes TEXT,
          source TEXT DEFAULT 'manual',
          is_internal BOOLEAN DEFAULT FALSE,
          lead_id INTEGER
        );
      `);
      
      console.log('Tabla tickets creada exitosamente.');
      
      // Insertar datos de ejemplo
      console.log('Insertando tickets de ejemplo...');
      await db.execute(sql`
        INSERT INTO tickets (title, description, status, priority, category)
        VALUES 
          ('Problema con el servicio', 'Cliente reporta problemas de conexión', 'abierto', 'alta', 'soporte'),
          ('Solicitud de información', 'Necesita información sobre precios', 'abierto', 'media', 'ventas'),
          ('Seguimiento de pago', 'Seguimiento de pago pendiente', 'abierto', 'baja', 'finanzas');
      `);
      
      console.log('Datos de ejemplo insertados exitosamente.');
    } else {
      console.log('La tabla tickets ya existe.');
      
      // Verificar si tiene la columna assigned_agent_id
      const hasAssignedAgentId = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'tickets' AND column_name = 'assigned_agent_id'
        );
      `);
      
      const assignedAgentIdExists = hasAssignedAgentId.rows && hasAssignedAgentId.rows[0] && hasAssignedAgentId.rows[0].exists === true;
      
      if (!assignedAgentIdExists) {
        console.log('Añadiendo columna assigned_agent_id...');
        await db.execute(sql`
          ALTER TABLE tickets ADD COLUMN assigned_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL;
        `);
        console.log('Columna assigned_agent_id añadida exitosamente.');
      }
      
      // Verificar si tiene la columna is_internal
      const hasIsInternal = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'tickets' AND column_name = 'is_internal'
        );
      `);
      
      const isInternalExists = hasIsInternal.rows && hasIsInternal.rows[0] && hasIsInternal.rows[0].exists === true;
      
      if (!isInternalExists) {
        console.log('Añadiendo columna is_internal...');
        await db.execute(sql`ALTER TABLE tickets ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;`);
        console.log('Columna is_internal añadida exitosamente.');
      }
      
      // Verificar registros
      const countResult = await db.execute(sql`SELECT COUNT(*) FROM tickets;`);
      const count = parseInt(countResult.rows[0].count);
      
      if (count === 0) {
        console.log('No hay tickets en la tabla. Insertando tickets de ejemplo...');
        await db.execute(sql`
          INSERT INTO tickets (title, description, status, priority, category)
          VALUES 
            ('Problema con el servicio', 'Cliente reporta problemas de conexión', 'abierto', 'alta', 'soporte'),
            ('Solicitud de información', 'Necesita información sobre precios', 'abierto', 'media', 'ventas'),
            ('Seguimiento de pago', 'Seguimiento de pago pendiente', 'abierto', 'baja', 'finanzas');
        `);
        console.log('Datos de ejemplo insertados exitosamente.');
      } else {
        console.log(`La tabla tickets ya contiene ${count} registros.`);
      }
    }
    
    console.log('Verificación y corrección de la tabla tickets completada exitosamente.');
  } catch (error) {
    console.error('Error al verificar/crear la tabla tickets:', error);
  }
}

// Ejecutar la función
fixTicketsTable()
  .then(() => {
    console.log('Proceso completado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error en el proceso:', error);
    process.exit(1);
  });