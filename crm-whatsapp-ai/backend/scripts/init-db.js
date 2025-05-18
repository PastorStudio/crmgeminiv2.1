/**
 * Script de inicialización de la base de datos PostgreSQL
 * Ejecutar con: node backend/scripts/init-db.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Verificar variables de entorno
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL no está definida en las variables de entorno');
  process.exit(1);
}

// Conectar a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Consultas SQL para crear las tablas
const createTableQueries = [
  // Tabla de usuarios
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,

  // Tabla de leads
  `CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status TEXT NOT NULL DEFAULT 'nuevo',
    source TEXT,
    assigned_to INTEGER REFERENCES users(id),
    notes TEXT,
    last_contact TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,

  // Tabla de actividades
  `CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    notes TEXT,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,

  // Tabla de mensajes
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    content TEXT NOT NULL,
    direction TEXT NOT NULL,
    channel TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,

  // Tabla de encuestas
  `CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    responses JSONB,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
  )`,

  // Tabla de estadísticas del dashboard
  `CREATE TABLE IF NOT EXISTS dashboard_stats (
    id SERIAL PRIMARY KEY,
    total_leads INTEGER NOT NULL DEFAULT 0,
    new_leads_this_month INTEGER NOT NULL DEFAULT 0,
    converted_leads_this_month INTEGER NOT NULL DEFAULT 0,
    total_messages INTEGER NOT NULL DEFAULT 0,
    response_rate INTEGER NOT NULL DEFAULT 0,
    avg_response_time INTEGER NOT NULL DEFAULT 0,
    leads_per_source JSONB,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,

  // Tabla de configuraciones de Gemini
  `CREATE TABLE IF NOT EXISTS gemini_settings (
    id SERIAL PRIMARY KEY,
    model TEXT NOT NULL DEFAULT 'gemini-pro',
    profession_level TEXT NOT NULL DEFAULT 'professional',
    temperature INTEGER NOT NULL DEFAULT 70,
    max_tokens INTEGER NOT NULL DEFAULT 500,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,

  // Índices para mejorar el rendimiento
  `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)`,
];

// Datos de ejemplo para inicializar la base de datos
const sampleDataQueries = [
  // Usuario administrador
  `INSERT INTO users (username, password, full_name, email, role)
  VALUES ('admin', '$2b$10$X7bE6JZAx.m1oPXgJ3A/1.6eF1WGJr.nLWYJnPZD5GYPk2bBFLm9e', 'Administrador', 'admin@example.com', 'admin')
  ON CONFLICT (username) DO NOTHING`,

  // Leads de ejemplo
  `INSERT INTO leads (name, email, phone, company, status, source, notes)
  VALUES 
    ('Tecnología Innovadora S.A.', 'contacto@tecnologiainnovadora.com', '+5491198765432', 'Tecnología Innovadora', 'nuevo', 'web', 'Interesado en implementación de sistema CRM'),
    ('Distribuidora Global', 'ventas@distribuidoraglobal.com', '+5491187654321', 'Distribuidora Global', 'contactado', 'referido', 'Necesita automatizar gestión de clientes'),
    ('Servicios Profesionales', 'info@serviciosprofesionales.com', '+5491176543210', 'Servicios Profesionales', 'negociación', 'linkedin', 'En proceso de evaluar propuesta'),
    ('Manufacturas del Sur', 'compras@manufacturasdelsur.com', '+5491165432109', 'Manufacturas del Sur', 'cerrado', 'evento', 'Contrato firmado para implementación en Q3'),
    ('Consultora Estratégica', 'proyectos@consultoraest.com', '+5491154321098', 'Consultora Estratégica', 'perdido', 'anuncio', 'Decidieron ir con otro proveedor')
  ON CONFLICT DO NOTHING`,

  // Configuración inicial de Gemini
  `INSERT INTO gemini_settings (model, profession_level, temperature, max_tokens)
  VALUES ('gemini-pro', 'professional', 70, 500)
  ON CONFLICT DO NOTHING`,

  // Estadísticas iniciales del dashboard
  `INSERT INTO dashboard_stats (total_leads, new_leads_this_month, converted_leads_this_month, total_messages)
  VALUES (5, 3, 1, 0)
  ON CONFLICT DO NOTHING`
];

// Función principal
async function initializeDatabase() {
  const client = await pool.connect();

  try {
    // Iniciar transacción
    await client.query('BEGIN');

    console.log('Creando tablas en la base de datos...');
    for (const query of createTableQueries) {
      await client.query(query);
    }

    console.log('Creando datos de ejemplo...');
    for (const query of sampleDataQueries) {
      await client.query(query);
    }

    // Confirmar transacción
    await client.query('COMMIT');
    console.log('Inicialización de la base de datos completada con éxito!');

  } catch (error) {
    // Revertir transacción en caso de error
    await client.query('ROLLBACK');
    console.error('Error al inicializar la base de datos:', error);
    process.exit(1);
  } finally {
    // Liberar el cliente
    client.release();
    // Cerrar el pool
    await pool.end();
  }
}

// Ejecutar inicialización
initializeDatabase();