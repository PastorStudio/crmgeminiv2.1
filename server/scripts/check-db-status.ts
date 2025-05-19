/**
 * Script para verificar el estado de las tablas en la base de datos
 * Este script comprueba la conectividad y el número de registros en tablas clave
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log("Verificando conectividad con la base de datos...");
    const dbCheck = await db.execute(sql`SELECT 1 as connected`);
    console.log("Conexión a base de datos: ", dbCheck.rows[0]?.connected === 1 ? "OK ✅" : "FALLO ❌");
    
    // Verificar tabla de tickets
    console.log("\n--- Estado de Tablas ---");
    try {
      const ticketCount = await db.execute(sql`SELECT COUNT(*) as count FROM tickets`);
      console.log(`Tabla tickets: ${ticketCount.rows[0]?.count || 0} registros`);
      
      // Mostrar ejemplo de ticket
      if (parseInt(ticketCount.rows[0]?.count) > 0) {
        const ticketSample = await db.execute(sql`SELECT * FROM tickets LIMIT 1`);
        console.log("Ejemplo de ticket:");
        console.log(ticketSample.rows[0]);
      }
    } catch (error) {
      console.error("Error al verificar tabla tickets:", error.message);
    }
    
    // Verificar tabla de agentes
    try {
      const agentCount = await db.execute(sql`SELECT COUNT(*) as count FROM agents`);
      console.log(`\nTabla agents: ${agentCount.rows[0]?.count || 0} registros`);
      
      // Mostrar ejemplo de agente
      if (parseInt(agentCount.rows[0]?.count) > 0) {
        const agentSample = await db.execute(sql`SELECT * FROM agents LIMIT 1`);
        console.log("Ejemplo de agente:");
        console.log(agentSample.rows[0]);
      }
    } catch (error) {
      console.error("Error al verificar tabla agents:", error.message);
    }
    
    // Verificar tabla de usuarios
    try {
      const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
      console.log(`\nTabla users: ${userCount.rows[0]?.count || 0} registros`);
      
      // Mostrar ejemplo de usuario
      if (parseInt(userCount.rows[0]?.count) > 0) {
        const userSample = await db.execute(sql`SELECT * FROM users LIMIT 1`);
        console.log("Ejemplo de usuario:");
        console.log(userSample.rows[0]);
      }
    } catch (error) {
      console.error("Error al verificar tabla users:", error.message);
    }
    
    // Verificar tabla de actividades
    try {
      const activityCount = await db.execute(sql`SELECT COUNT(*) as count FROM activities`);
      console.log(`\nTabla activities: ${activityCount.rows[0]?.count || 0} registros`);
      
      // Mostrar ejemplo de actividad
      if (parseInt(activityCount.rows[0]?.count) > 0) {
        const activitySample = await db.execute(sql`SELECT * FROM activities LIMIT 1`);
        console.log("Ejemplo de actividad:");
        console.log(activitySample.rows[0]);
      }
    } catch (error) {
      console.error("Error al verificar tabla activities:", error.message);
    }
    
    // Verificar rutas de la API
    console.log("\n--- Estado de Rutas API ---");
    
    // Verificar ruta de agentes
    try {
      const agentsRoute = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_tables 
          WHERE tablename = 'agents'
        ) as exists
      `);
      
      console.log(`Ruta /api/agents disponible: ${agentsRoute.rows[0]?.exists ? "Sí ✅" : "No ❌"}`);
    } catch (error) {
      console.error("Error al verificar ruta de agentes:", error.message);
    }
    
    // Verificar ruta de tickets
    try {
      const ticketsRoute = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_tables 
          WHERE tablename = 'tickets'
        ) as exists
      `);
      
      console.log(`Ruta /api/tickets disponible: ${ticketsRoute.rows[0]?.exists ? "Sí ✅" : "No ❌"}`);
    } catch (error) {
      console.error("Error al verificar ruta de tickets:", error.message);
    }
    
  } catch (error) {
    console.error("Error al verificar estado de la base de datos:", error);
  } finally {
    process.exit(0);
  }
}

main();