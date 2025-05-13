/**
 * Script para inicializar la base de datos y ejecutar migraciones
 * 
 * Uso:
 * - npm run db:push (para migrar el esquema)
 * - npm run db:seed (para poblar con datos de prueba)
 */

import { db, isDatabaseAvailable, pool } from "../db";
import * as schema from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { storage } from "../storage";

async function main() {
  if (!isDatabaseAvailable) {
    console.error("ERROR: No hay conexión a la base de datos. Asegúrate de tener DATABASE_URL configurado.");
    process.exit(1);
  }

  try {
    console.log("Iniciando migración del esquema...");
    
    // Crear las tablas según el esquema definido
    await db.execute(/* sql */`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        email TEXT,
        role TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        position TEXT,
        source TEXT,
        status TEXT,
        notes TEXT,
        assigned_to INTEGER,
        last_contact TIMESTAMP,
        value DOUBLE PRECISION,
        conversion_probability INTEGER,
        tags TEXT,
        website TEXT,
        whatsapp_phone TEXT,
        whatsapp_chat_id TEXT,
        telegram_user TEXT,
        telegram_chat_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        lead_id INTEGER,
        user_id INTEGER,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        completed BOOLEAN DEFAULT FALSE,
        created_by INTEGER,
        ai_generated BOOLEAN DEFAULT FALSE,
        ai_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER,
        user_id INTEGER,
        direction TEXT NOT NULL,
        channel TEXT NOT NULL,
        content TEXT NOT NULL,
        ai_generated BOOLEAN DEFAULT FALSE,
        read BOOLEAN DEFAULT FALSE,
        ai_analysis JSONB,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS surveys (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER,
        title TEXT NOT NULL,
        created_by INTEGER,
        questions JSONB NOT NULL,
        responses JSONB,
        ai_analysis JSONB,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS dashboard_stats (
        id SERIAL PRIMARY KEY,
        total_leads INTEGER,
        conversion_rate INTEGER,
        active_conversations INTEGER,
        today_meetings INTEGER,
        leads_by_status JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log("Esquema migrado exitosamente");
    
    // Inicializar datos de prueba si es necesario
    console.log("Inicializando datos de prueba...");
    await storage.initializeData();
    
    console.log("¡Base de datos inicializada correctamente!");
  } catch (error) {
    console.error("Error durante la inicialización de la base de datos:", error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main();