import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { whatsappAccounts, autoResponseConfigs } from "../shared/schema";
import { setupVite } from "./vite";
import { registerDirectAPIRoutes } from "./services/directApiServer";
import { storage } from "./storage";
import whatsappAccountsRouter from "./routes/whatsappAccounts";

console.log('🚀 Iniciando CRM WhatsApp...');

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// QR ENDPOINT - MUST BE BEFORE OTHER ROUTES
app.get('/api/qr/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    console.log(`📱 Direct QR request for account ${accountId}`);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Read QR directly from file
    const qrFilePath = path.join(process.cwd(), 'temp', 'whatsapp-qr', `qr_${accountId}.json`);
    
    if (fs.existsSync(qrFilePath)) {
      try {
        const fileContent = fs.readFileSync(qrFilePath, 'utf8');
        const qrInfo = JSON.parse(fileContent);
        
        if (qrInfo.text) {
          console.log(`✅ QR text found for account ${accountId}`);
          return res.json({
            success: true,
            qrCode: qrInfo.text,
            dataUrl: qrInfo.dataUrl || null,
            generatedAt: qrInfo.generatedAt,
            expiresAt: qrInfo.expiresAt
          });
        }
      } catch (parseError) {
        console.error(`❌ Error parsing QR file:`, parseError);
      }
    }
    
    // Fallback to text file
    const textQrPath = path.join(process.cwd(), 'temp', 'whatsapp-qr.txt');
    if (fs.existsSync(textQrPath)) {
      try {
        const qrText = fs.readFileSync(textQrPath, 'utf8').trim();
        if (qrText && qrText.length > 10) {
          console.log(`✅ QR text found in fallback file`);
          return res.json({
            success: true,
            qrCode: qrText
          });
        }
      } catch (readError) {
        console.error(`❌ Error reading fallback QR file:`, readError);
      }
    }
    
    console.log(`❌ No QR found for account ${accountId}`);
    res.status(404).json({
      success: false,
      error: 'QR code not found'
    });
    
  } catch (error) {
    console.error('❌ Error in direct QR endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Auto-response toggle endpoint
app.post('/api/whatsapp-accounts/:accountId/auto-response/toggle', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { enabled } = req.body;
    
    console.log(`🔄 Toggling auto-response for account ${accountId}: ${enabled}`);
    
    res.setHeader('Content-Type', 'application/json');
    
    if (isNaN(accountId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de cuenta inválido' 
      });
    }
    
    // Update auto-response configuration directly in database
    try {
      // Update whatsapp_accounts table
      await db.execute(sql`
        UPDATE whatsapp_accounts 
        SET autoresponseenabled = ${enabled}
        WHERE id = ${accountId}
      `);
      
      // Try to update auto_response_configs if it exists
      const configExists = await db.execute(sql`
        SELECT id FROM auto_response_configs WHERE account_id = ${accountId} LIMIT 1
      `);
      
      if (configExists.rows.length > 0) {
        await db.execute(sql`
          UPDATE auto_response_configs 
          SET enabled = ${enabled}, updated_at = NOW()
          WHERE account_id = ${accountId}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO auto_response_configs (account_id, enabled, created_at, updated_at)
          VALUES (${accountId}, ${enabled}, NOW(), NOW())
        `);
      }
    } catch (dbError) {
      console.log('Database update warning:', dbError);
      // Continue even if config table update fails
    }
    
    console.log(`✅ Auto-response ${enabled ? 'enabled' : 'disabled'} for account ${accountId}`);
    
    res.json({ 
      success: true, 
      message: `Auto-response ${enabled ? 'activado' : 'desactivado'} exitosamente`,
      enabled 
    });
    
  } catch (error) {
    console.error('❌ Error toggling auto-response:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Auto-response status endpoint
app.get('/api/whatsapp-accounts/:accountId/auto-response-status', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    res.setHeader('Content-Type', 'application/json');
    
    if (isNaN(accountId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de cuenta inválido' 
      });
    }
    
    // Get auto-response configuration directly from database
    const accountResult = await db.execute(sql`
      SELECT autoresponseenabled FROM whatsapp_accounts WHERE id = ${accountId} LIMIT 1
    `);
    
    const enabled = accountResult.rows[0]?.autoresponseenabled || false;
    
    res.json({ 
      success: true, 
      enabled: enabled,
      config: { enabled, accountId }
    });
    
  } catch (error) {
    console.error('❌ Error getting auto-response status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// Rutas básicas
app.use('/api/whatsapp-accounts', whatsappAccountsRouter);

// Registrar rutas de API directa
registerDirectAPIRoutes(app);

// AI Settings endpoints - MUST BE BEFORE VITE SETUP
app.get('/api/ai-settings', async (req, res) => {
  console.log('📋 GET /api/ai-settings - Obteniendo configuraciones');
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  
  try {
    const { aiSettings } = await import('@shared/schema');
    const [settings] = await db.select().from(aiSettings).limit(1);
    
    if (settings) {
      console.log('✅ Configuraciones encontradas');
      res.json({
        success: true,
        data: settings
      });
    } else {
      console.log('⚠️ No se encontraron configuraciones, devolviendo valores por defecto');
      res.json({
        success: true,
        data: {
          selectedProvider: 'gemini',
          geminiApiKey: null,
          openaiApiKey: null,
          qwenApiKey: null,
          deepseekApiKey: null,
          customPrompt: 'Eres un asistente virtual útil y amigable. Responde de manera profesional y concisa.',
          temperature: 0.7,
          enableAIResponses: false,
          disableGroupResponses: false
        }
      });
    }
  } catch (error) {
    console.error('❌ Error obteniendo configuraciones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener configuraciones' 
    });
  }
});

app.post('/api/ai-settings', async (req, res) => {
  console.log('📝 POST /api/ai-settings - Inicio del endpoint');
  console.log('📝 Datos recibidos:', req.body);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  
  try {
    const { aiSettings } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const {
      selectedProvider,
      geminiApiKey,
      openaiApiKey,
      qwenApiKey,
      deepseekApiKey,
      customPrompt,
      temperature,
      enableAIResponses,
      disableGroupResponses
    } = req.body;
    
    console.log('✅ Validando datos manualmente...');
    
    const validatedData = {
      selectedProvider: selectedProvider || 'gemini',
      geminiApiKey: geminiApiKey || null,
      openaiApiKey: openaiApiKey || null,
      qwenApiKey: qwenApiKey || null,
      deepseekApiKey: deepseekApiKey || null,
      customPrompt: customPrompt || 'Eres un asistente virtual útil y amigable. Responde de manera profesional y concisa.',
      temperature: temperature || 0.7,
      enableAIResponses: enableAIResponses || false,
      disableGroupResponses: disableGroupResponses || false
    };
    
    console.log('✅ Datos procesados:', validatedData);
    
    const [existingSettings] = await db.select().from(aiSettings).limit(1);
    
    if (existingSettings) {
      console.log('🔄 Actualizando configuración existente con ID:', existingSettings.id);
      const [updatedSettings] = await db
        .update(aiSettings)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(aiSettings.id, existingSettings.id))
        .returning();
      
      console.log('✅ Configuración actualizada exitosamente');
      return res.status(200).json({
        success: true,
        message: 'Configuraciones de AI actualizadas correctamente',
        data: updatedSettings
      });
    } else {
      console.log('🆕 Creando nueva configuración');
      const [newSettings] = await db
        .insert(aiSettings)
        .values(validatedData)
        .returning();
      
      console.log('✅ Nueva configuración creada exitosamente');
      return res.status(200).json({
        success: true,
        message: 'Configuraciones de AI creadas correctamente',
        data: newSettings
      });
    }
  } catch (error) {
    console.error('❌ Error crítico en /api/ai-settings:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    return res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AI Prompts endpoints - MUST BE BEFORE VITE SETUP
app.get('/api/ai-prompts', async (req, res) => {
  try {
    console.log('📋 GET /api/ai-prompts - Obteniendo prompts AI');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    const { aiPrompts } = await import('@shared/schema');
    const prompts = await db.select().from(aiPrompts).orderBy(aiPrompts.createdAt);
    
    console.log('✅ Prompts obtenidos:', prompts.length);
    res.json(prompts);
  } catch (error) {
    console.error('❌ Error obteniendo prompts AI:', error);
    res.status(500).json({ error: 'Error al obtener prompts' });
  }
});

app.post('/api/ai-prompts', async (req, res) => {
  try {
    console.log('📝 POST /api/ai-prompts - Creando prompt AI');
    console.log('📝 Datos recibidos:', req.body);
    
    res.setHeader('Content-Type', 'application/json');
    
    const { aiPrompts } = await import('@shared/schema');
    const {
      name,
      description,
      content,
      provider = 'openai',
      temperature = 0.7,
      maxTokens = 1000,
      model = 'gpt-4o',
      isActive = true
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y contenido son requeridos'
      });
    }

    const [newPrompt] = await db.insert(aiPrompts).values({
      name,
      description,
      content,
      provider,
      temperature,
      maxTokens,
      model,
      isActive
    }).returning();
    
    console.log('✅ Prompt creado:', newPrompt);
    res.json({
      success: true,
      message: 'Prompt AI creado exitosamente',
      prompt: newPrompt
    });
  } catch (error) {
    console.error('❌ Error creando prompt AI:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear prompt',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.put('/api/ai-prompts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`📝 PUT /api/ai-prompts/${id} - Actualizando prompt AI`);
    
    res.setHeader('Content-Type', 'application/json');
    
    const { aiPrompts } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const {
      name,
      description,
      content,
      provider,
      temperature,
      maxTokens,
      model,
      isActive
    } = req.body;

    const [updatedPrompt] = await db.update(aiPrompts)
      .set({
        name,
        description,
        content,
        provider,
        temperature,
        maxTokens,
        model,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(aiPrompts.id, id))
      .returning();
    
    if (!updatedPrompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt no encontrado'
      });
    }
    
    console.log('✅ Prompt actualizado:', updatedPrompt);
    res.json({
      success: true,
      message: 'Prompt AI actualizado exitosamente',
      prompt: updatedPrompt
    });
  } catch (error) {
    console.error('❌ Error actualizando prompt AI:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar prompt',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.delete('/api/ai-prompts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(`🗑️ DELETE /api/ai-prompts/${id} - Eliminando prompt AI`);
    
    res.setHeader('Content-Type', 'application/json');
    
    const { aiPrompts } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [deletedPrompt] = await db.delete(aiPrompts)
      .where(eq(aiPrompts.id, id))
      .returning();
    
    if (!deletedPrompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt no encontrado'
      });
    }
    
    console.log('✅ Prompt eliminado:', deletedPrompt);
    res.json({
      success: true,
      message: 'Prompt AI eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error eliminando prompt AI:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar prompt',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Inicializar datos
storage.initializeData().catch(console.error);

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Servidor iniciado en puerto ${PORT}`);
  console.log(`🌐 Interfaz disponible en: http://localhost:${PORT}`);
  
  // Integrar con Vite después de iniciar el servidor
  await setupVite(app, server);
});

// Manejo de errores
server.on('error', (error: any) => {
  console.error('❌ Error del servidor:', error);
});

export { app };