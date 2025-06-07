-- Database initialization script for CRM WhatsApp AI
-- This script creates the initial database structure and inserts default data

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE crm_whatsapp_ai' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_whatsapp_ai')\gexec

-- Connect to the database
\c crm_whatsapp_ai;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'agent',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create whatsapp_accounts table
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_name VARCHAR(255),
    owner_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'disconnected',
    qr_code TEXT,
    session_data TEXT,
    auto_response_enabled BOOLEAN DEFAULT true,
    assigned_external_agent_id VARCHAR(255),
    response_delay INTEGER DEFAULT 1000,
    message_limit_per_hour INTEGER DEFAULT 100,
    daily_message_count INTEGER DEFAULT 0,
    last_message_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    last_activity_at TIMESTAMP,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    profile_pic_url TEXT,
    is_business BOOLEAN DEFAULT false,
    labels TEXT[],
    notes TEXT,
    last_message_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(whatsapp_account_id, phone)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    message_id VARCHAR(255) UNIQUE,
    type VARCHAR(50) DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(50),
    direction VARCHAR(20) NOT NULL, -- 'incoming' or 'outgoing'
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    timestamp BIGINT,
    is_forwarded BOOLEAN DEFAULT false,
    reply_to_message_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    company VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new',
    source VARCHAR(100) DEFAULT 'whatsapp',
    assigned_agent_id INTEGER REFERENCES users(id),
    estimated_value DECIMAL(10,2),
    notes TEXT,
    last_interaction_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    category VARCHAR(100),
    assigned_agent_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Create chat_assignments table
CREATE TABLE IF NOT EXISTS chat_assignments (
    id SERIAL PRIMARY KEY,
    whatsapp_account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    chat_id VARCHAR(255) NOT NULL,
    agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    tags TEXT[],
    priority INTEGER DEFAULT 0
);

-- Create agent_activity table
CREATE TABLE IF NOT EXISTS agent_activity (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    page VARCHAR(255),
    details TEXT,
    category VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT
);

-- Create flow_templates table
CREATE TABLE IF NOT EXISTS flow_templates (
    id SERIAL PRIMARY KEY,
    template_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    difficulty VARCHAR(50),
    nodes INTEGER DEFAULT 0,
    estimated_time VARCHAR(50),
    icon VARCHAR(100),
    color VARCHAR(100),
    tags TEXT[],
    flow_data JSONB,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sales_flows table
CREATE TABLE IF NOT EXISTS sales_flows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    nodes JSONB,
    edges JSONB,
    template_id VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user
INSERT INTO users (username, password, email, role) 
VALUES ('admin', crypt('admin123', gen_salt('bf')), 'admin@crm.local', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert default agent user
INSERT INTO users (username, password, email, role) 
VALUES ('agent', crypt('agent123', gen_salt('bf')), 'agent@crm.local', 'agent')
ON CONFLICT (username) DO NOTHING;

-- Insert default WhatsApp account
INSERT INTO whatsapp_accounts (
    name, 
    description, 
    owner_name, 
    owner_phone, 
    status, 
    auto_response_enabled
) VALUES (
    'Cuenta Principal',
    'Cuenta principal de WhatsApp Business para CRM',
    'Administrador',
    '+1234567890',
    'disconnected',
    true
) ON CONFLICT DO NOTHING;

-- Insert default flow templates
INSERT INTO flow_templates (
    template_id,
    name,
    description,
    category,
    difficulty,
    nodes,
    estimated_time,
    icon,
    color,
    tags,
    flow_data
) VALUES 
(
    'lead-qualification',
    'Calificación de Leads',
    'Flujo completo para calificar nuevos leads desde WhatsApp hasta cierre de venta',
    'Ventas',
    'Principiante',
    8,
    '15 min',
    'Target',
    'bg-blue-500',
    ARRAY['WhatsApp', 'Calificación', 'CRM'],
    '{"nodes": [], "edges": []}'::jsonb
),
(
    'customer-support',
    'Soporte al Cliente',
    'Sistema inteligente de atención al cliente con escalamiento automático',
    'Soporte',
    'Intermedio',
    6,
    '20 min',
    'Headphones',
    'bg-green-500',
    ARRAY['Soporte', 'Tickets', 'Escalamiento'],
    '{"nodes": [], "edges": []}'::jsonb
),
(
    'ecommerce-sales',
    'Ventas E-commerce',
    'Automatización completa de ventas para tiendas online con seguimiento de carritos abandonados',
    'E-commerce',
    'Avanzado',
    7,
    '25 min',
    'ShoppingCart',
    'bg-purple-500',
    ARRAY['E-commerce', 'Carritos abandonados', 'Seguimiento'],
    '{"nodes": [], "edges": []}'::jsonb
)
ON CONFLICT (template_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_account_id ON messages(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp_account_id ON contacts(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_account_id ON leads(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_tickets_whatsapp_account_id ON tickets(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_agent_activity_agent_id ON agent_activity(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_timestamp ON agent_activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_assignments_whatsapp_account_id ON chat_assignments(whatsapp_account_id);
CREATE INDEX IF NOT EXISTS idx_chat_assignments_agent_id ON chat_assignments(agent_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_accounts_updated_at BEFORE UPDATE ON whatsapp_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flow_templates_updated_at BEFORE UPDATE ON flow_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_flows_updated_at BEFORE UPDATE ON sales_flows 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();