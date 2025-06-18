import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { Pool } from '@neondatabase/serverless';
import * as schema from "../shared/schema";

// Always use PostgreSQL database for real data
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not configured. PostgreSQL database required for real data.");
}

console.log("Connecting to PostgreSQL database...");
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// Export pool for legacy services that require it
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});