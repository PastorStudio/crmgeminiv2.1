import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as ws from "ws";
import * as schema from "../shared/schema";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

// Siempre usamos la base de datos PostgreSQL para datos reales
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurada. Se requiere una base de datos PostgreSQL para datos reales.");
}

console.log("Conectando a la base de datos PostgreSQL...");
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});
export const db = drizzle({ client: pool, schema });