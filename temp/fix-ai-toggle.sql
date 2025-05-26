-- Script temporal para arreglar configuración de agentes
UPDATE whatsapp_accounts 
SET assigned_external_agent_id = 'AD90gWIIujqVWqWXvIHcO', 
    auto_response_enabled = true 
WHERE id = 1;

UPDATE whatsapp_accounts 
SET assigned_external_agent_id = 'ORzAf9KL35UatbsL0Awgj', 
    auto_response_enabled = false 
WHERE id = 2;