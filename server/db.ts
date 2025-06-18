import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "../shared/schema";

// Always use PostgreSQL database for real data
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not configured. PostgreSQL database required for real data.");
}

console.log("Connecting to PostgreSQL database...");
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });