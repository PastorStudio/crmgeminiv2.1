-- Migration to add alphanumeric IDs with user letter assignments
-- This enables each user to have their own letter suffix (a, b, c...) for account IDs

-- Create user letter assignments table
CREATE TABLE IF NOT EXISTS user_letter_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
  assigned_letter TEXT NOT NULL UNIQUE,
  assigned_at TIMESTAMP DEFAULT NOW()
);

-- Add user letter column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_letter TEXT UNIQUE;

-- Backup existing WhatsApp accounts
CREATE TABLE IF NOT EXISTS whatsapp_accounts_backup AS 
SELECT * FROM whatsapp_accounts;

-- Create new WhatsApp accounts table with alphanumeric IDs
DROP TABLE IF EXISTS whatsapp_accounts_new;
CREATE TABLE whatsapp_accounts_new (
  id TEXT PRIMARY KEY, -- Alphanumeric ID like "1a", "2b", etc.
  numeric_id INTEGER NOT NULL, -- Sequence number within user: 1, 2, 3...
  user_suffix TEXT NOT NULL, -- User letter: "a", "b", "c"...
  name TEXT NOT NULL,
  description TEXT,
  ownername TEXT,
  ownerphone TEXT,
  sessiondata JSONB,
  status TEXT DEFAULT 'inactive',
  adminid INTEGER,
  user_id INTEGER NOT NULL REFERENCES users(id),
  organizationid INTEGER,
  assignedexternalagentid TEXT,
  autoresponseenabled BOOLEAN DEFAULT false,
  responsedelay INTEGER DEFAULT 3,
  disablegroupresponses BOOLEAN DEFAULT false,
  customprompt TEXT,
  assigned_prompt_id INTEGER,
  target_language TEXT DEFAULT 'es',
  translate_to_spanish BOOLEAN DEFAULT true,
  language_settings JSONB,
  keepaliveenabled BOOLEAN DEFAULT true,
  lastactivity TIMESTAMP,
  connectionattempts INTEGER DEFAULT 0,
  maxreconnectattempts INTEGER DEFAULT 5,
  createdat TIMESTAMP DEFAULT NOW(),
  lastactiveat TIMESTAMP
);

-- Assign letters to existing users
INSERT INTO user_letter_assignments (user_id, assigned_letter)
SELECT 
  id, 
  CASE 
    WHEN LOWER(username) = 'djp' THEN 'a'
    WHEN LOWER(username) = 'admin' THEN 'b'
    WHEN LOWER(username) = 'demo' THEN 'c'
    ELSE CHR(97 + (ROW_NUMBER() OVER (ORDER BY id) - 1) % 26)
  END as letter
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_letter_assignments WHERE user_id IS NOT NULL);

-- Update users table with their assigned letters
UPDATE users 
SET user_letter = ula.assigned_letter 
FROM user_letter_assignments ula 
WHERE users.id = ula.user_id;

-- Migrate existing WhatsApp accounts to new format
INSERT INTO whatsapp_accounts_new (
  id, numeric_id, user_suffix, name, description, ownername, ownerphone,
  sessiondata, status, adminid, user_id, organizationid, assignedexternalagentid,
  autoresponseenabled, responsedelay, disablegroupresponses, customprompt,
  target_language, translate_to_spanish, language_settings, keepaliveenabled,
  lastactivity, connectionattempts, maxreconnectattempts, createdat, lastactiveat
)
SELECT 
  CAST(wa.id AS TEXT) || COALESCE(ula.assigned_letter, 'z') as id,
  wa.id as numeric_id,
  COALESCE(ula.assigned_letter, 'z') as user_suffix,
  wa.name, wa.description, wa.ownername, wa.ownerphone,
  wa.sessiondata, wa.status, wa.adminid, wa.user_id, wa.organizationid,
  wa.assignedexternalagentid, wa.autoresponseenabled, wa.responsedelay,
  wa.disablegroupresponses, wa.customprompt, wa.target_language,
  wa.translate_to_spanish, wa.language_settings, wa.keepaliveenabled,
  wa.lastactivity, wa.connectionattempts, wa.maxreconnectattempts,
  wa.createdat, wa.lastactiveat
FROM whatsapp_accounts wa
LEFT JOIN user_letter_assignments ula ON wa.user_id = ula.user_id;

-- Drop old table and rename new one
DROP TABLE whatsapp_accounts CASCADE;
ALTER TABLE whatsapp_accounts_new RENAME TO whatsapp_accounts;

-- Recreate indexes and constraints
CREATE INDEX idx_whatsapp_accounts_user_id ON whatsapp_accounts(user_id);
CREATE INDEX idx_whatsapp_accounts_numeric_id ON whatsapp_accounts(numeric_id);
CREATE INDEX idx_whatsapp_accounts_user_suffix ON whatsapp_accounts(user_suffix);

-- Show results
SELECT 'User Letter Assignments:' as info;
SELECT u.username, u.id, ula.assigned_letter 
FROM users u 
LEFT JOIN user_letter_assignments ula ON u.id = ula.user_id;

SELECT 'WhatsApp Accounts with new IDs:' as info;
SELECT id, numeric_id, user_suffix, name, user_id 
FROM whatsapp_accounts 
ORDER BY user_id, numeric_id;