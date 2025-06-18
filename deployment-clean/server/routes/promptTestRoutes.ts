import { Request, Response, Router } from 'express';
import { pool } from '../db';
import { unifiedMessageProcessor } from '../services/unifiedMessageProcessor';

const router = Router();

// Test endpoint para verificar asignaciones de prompts
router.get("/test/prompt-assignments", async (req: Request, res: Response) => {
  try {
    console.log('🧪 Verificando asignaciones de prompts...');
    
    // Obtener asignaciones desde la base de datos
    const result = await pool.query(`
      SELECT wa.id, wa.name, wa.assigned_prompt_id, wa.autoresponseenabled,
             ap.name as prompt_name, ap.content as prompt_content
      FROM whatsapp_accounts wa
      LEFT JOIN ai_prompts ap ON wa.assigned_prompt_id = ap.id
      WHERE wa.autoresponseenabled = true
      ORDER BY wa.id
    `);

    const assignments = result.rows.map(row => ({
      accountId: row.id,
      accountName: row.name,
      assignedPromptId: row.assigned_prompt_id,
      promptName: row.prompt_name,
      promptPreview: row.prompt_content ? row.prompt_content.substring(0, 100) + '...' : 'No content',
      autoResponseEnabled: row.autoresponseenabled
    }));

    // Verificar configuración del procesador unificado
    const processorStatus = {
      initialized: unifiedMessageProcessor ? true : false,
      accountsConfigured: assignments.length,
      hasPromptCheck: typeof unifiedMessageProcessor.hasPromptForAccount === 'function'
    };

    // Test individual de cada cuenta
    const accountTests = assignments.map(account => {
      const hasPrompt = unifiedMessageProcessor.hasPromptForAccount ? 
        unifiedMessageProcessor.hasPromptForAccount(account.accountId) : false;
      const config = unifiedMessageProcessor.getAccountConfig ? 
        unifiedMessageProcessor.getAccountConfig(account.accountId) : null;
      
      return {
        accountId: account.accountId,
        accountName: account.accountName,
        hasPromptAssigned: hasPrompt,
        configLoaded: !!config,
        promptDetails: config
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      assignments,
      processorStatus,
      accountTests,
      expectedAssignments: {
        'Account 1 (GeminiCRM)': 'Prompt 8 (Medical Assistant)',
        'Account 2 (Ventas)': 'Prompt 9 (Sales Agent CRM)',
        'Account 3 (GeminiCRM)': 'Prompt 9 (Sales Agent CRM)',
        'Account 4 (cuenta de facebook)': 'Prompt 7 (Zoe - CRM Support)'
      }
    });

  } catch (error) {
    console.error('❌ Error verificando asignaciones de prompts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error verificando asignaciones de prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test de procesamiento de mensaje simulado
router.post("/test/message-processing", async (req: Request, res: Response) => {
  try {
    const { accountId, message, chatId } = req.body;
    
    if (!accountId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'accountId y message son requeridos' 
      });
    }

    console.log(`🧪 Probando procesamiento de mensaje para cuenta ${accountId}: "${message}"`);

    // Simular contexto de mensaje
    const context = {
      chatId: chatId || `test-${Date.now()}`,
      accountId: parseInt(accountId),
      from: chatId || `test-${Date.now()}`,
      body: message,
      contactName: 'Usuario Test',
      fromMe: false
    };

    // Procesar mensaje con el procesador unificado
    const result = await unifiedMessageProcessor.processMessage(context);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      testInput: context,
      processingResult: result,
      summary: {
        source: result.source,
        hasResponse: !!result.response,
        agentUsed: result.agentName || 'No agent',
        responsePreview: result.response ? result.response.substring(0, 200) + '...' : 'No response'
      }
    });

  } catch (error) {
    console.error('❌ Error en test de procesamiento:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error en test de procesamiento',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Recargar configuraciones de prompts
router.post("/test/reload-prompts", async (req: Request, res: Response) => {
  try {
    console.log('🔄 Recargando configuraciones de prompts...');
    
    await unifiedMessageProcessor.reloadConfigurations();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Configuraciones de prompts recargadas correctamente'
    });

  } catch (error) {
    console.error('❌ Error recargando configuraciones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error recargando configuraciones',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;