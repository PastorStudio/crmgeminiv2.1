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