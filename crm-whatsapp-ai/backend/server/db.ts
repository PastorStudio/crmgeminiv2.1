import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema';

// Configuración para WebSockets en Neon DB
neonConfig.webSocketConstructor = ws;

// Verificar si existe la variable de entorno DATABASE_URL
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL debe estar configurada. Verifica tus variables de entorno."
  );
}

// Crear pool de conexiones a la base de datos
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Inicializar Drizzle ORM con el esquema
export const db = drizzle({ client: pool, schema });