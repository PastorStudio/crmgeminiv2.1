import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Variable para indicar si estamos usando una base de datos real o no
export const isDatabaseAvailable = !!process.env.DATABASE_URL;

// Exporta las variables solo si la base de datos está disponible
export let pool: Pool | null = null;
export let db: any = null;

if (isDatabaseAvailable) {
  console.log("Conectando a la base de datos PostgreSQL...");
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
} else {
  console.log("ADVERTENCIA: DATABASE_URL no está configurada. Usando almacenamiento en memoria.");
}