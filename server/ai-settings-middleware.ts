import type { Express, Request, Response } from "express";
import { db } from "./db";
import { aiSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerAISettingsRoutes(app: Express) {
  // Get AI settings
  app.get('/api/ai-settings', async (req: Request, res: Response) => {
    console.log('📋 GET /api/ai-settings - Obteniendo configuraciones');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    try {
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

  // Save AI settings
  app.post('/api/ai-settings', async (req: Request, res: Response) => {
    console.log('📝 POST /api/ai-settings - Inicio del endpoint');
    console.log('📝 Datos recibidos:', req.body);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    try {
      // Extract all API keys including DeepSeek
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
      
      // Create validated data object with DeepSeek support
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
      
      // Check if configuration already exists
      const [existingSettings] = await db.select().from(aiSettings).limit(1);
      
      if (existingSettings) {
        console.log('🔄 Actualizando configuración existente con ID:', existingSettings.id);
        // Update existing configuration
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
        // Create new configuration
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
}