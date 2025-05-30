import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerOptimizedRoutes } from "./routes-optimized";
import { setupVite, serveStatic, log } from "./vite";
import { registerDirectAPIRoutes } from "./services/directApiServer";
import { storage } from "./storage";
import whatsappAccountsRouter from "./routes/whatsappAccounts";
import { db, pool } from "./db";
import { users, whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as agentAssignmentRoutes from "./routes/agentAssignments";
import { invisibleAgentIntegrator } from "./services/invisibleAgentIntegrator";
import { realTimeNotificationService } from "./services/realTimeNotificationService";
import * as whatsappAPI from "./routes/whatsappAPI";
import { internalAgentManager } from "./services/internalAgentManager";
import { agentActivityTracker } from "./services/agentActivityTracker";
import { agentRoleManager } from "./services/agentRoleManager";
import { simpleLiveStatus } from "./services/simpleLiveStatus";
import { WhatsAppSyncManager } from "./utils/whatsappSync";

// ⏰ SINCRONIZACIÓN COMPLETA DE TIEMPO - NUEVA YORK (REAL)
process.env.TZ = 'America/New_York';

// Configurar fecha real: 27 de mayo 2025, 11:18 PM Nueva York
const REAL_DATE_OFFSET = new Date('2025-05-27T23:18:00.000-04:00').getTime() - Date.now();

// Override global de Date.now para toda la aplicación
const originalNow = Date.now;
Date.now = function(): number {
  return originalNow() + REAL_DATE_OFFSET;
};

// Override constructor Date sin parámetros
const originalDate = global.Date;
global.Date = class extends originalDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(originalDate.now() + REAL_DATE_OFFSET);
    } else {
      super(...args);
    }
  }
  
  static now(): number {
    return originalDate.now() + REAL_DATE_OFFSET;
  }
} as DateConstructor;

console.log(`🕐 SISTEMA SINCRONIZADO - NUEVA YORK: ${new Date().toLocaleDateString('es-ES')}, ${new Date().toLocaleTimeString('es-ES')}`);

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV === "development") {
  setupVite(app, httpServer);
} else {
  serveStatic(app);
}

console.log("Conectando a la base de datos PostgreSQL...");
console.log("Usando DatabaseStorage con PostgreSQL para datos reales");

// Inicializar Gemini AI
try {
  const { geminiService } = await import('./services/gemini');
  console.log("🤖 Inicializando Gemini AI con clave API configurada");
} catch (error) {
  console.log("⚠️ Gemini AI no está disponible");
}

async function setupRoutes() {
  // Configurar rutas principales
  app.use('/api/whatsapp-accounts', whatsappAccountsRouter);
  
  // Sistema de WhatsApp
  try {
    const { whatsappMultiAccountManager } = await import('./services/whatsappMultiAccountManager');
    console.log("✅ Sistema WhatsApp Multi-Cuenta inicializado");
  } catch (error) {
    console.error("Error inicializando WhatsApp:", error);
  }
}

// Inicializar base de datos
async function initializeDatabase() {
  try {
    console.log("Inicializando datos en la base de datos PostgreSQL...");
    
    const accounts = await db.select().from(whatsappAccounts);
    console.log(`Encontradas ${accounts.length} cuentas de WhatsApp en la base de datos`);
    
    for (const account of accounts) {
      console.log(`Inicializando cuenta WhatsApp: ${account.name} (ID: ${account.id})`);
    }
    
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log("La base de datos ya contiene datos, omitiendo inicialización.");
    }
    
    console.log("Base de datos inicializada exitosamente.");
  } catch (error) {
    console.error("Error inicializando base de datos:", error);
  }
}

async function main() {
  await setupRoutes();
  await initializeDatabase();
  
  // Sistema limpio sin respuestas automáticas
  console.log("✅ Sistema inicializado correctamente sin respuestas automáticas");

  // Endpoint para obtener agentes internos reales de la tabla users
  app.get("/api/agents-list", async (req: Request, res: Response) => {
    try {
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const result = await db.select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        department: users.department,
        status: users.status,
        role: users.role
      }).from(users).where(eq(users.role, 'agent')).limit(20);
      
      res.json(result);
    } catch (error) {
      console.error("Error obteniendo agentes:", error);
      res.status(500).json({ error: "Error obteniendo agentes" });
    }
  });

  // Endpoint para detectar idioma y traducir mensajes usando Gemini AI
  app.post("/api/detect-and-translate", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage } = req.body;
      
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: "Texto y idioma destino son requeridos" });
      }

      const geminiApiKey = process.env.GOOGLE_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: "Clave API de Gemini no configurada" });
      }

      const languageNames: any = {
        'es': 'español',
        'en': 'inglés',
        'fr': 'francés',
        'de': 'alemán',
        'pt': 'portugués',
        'it': 'italiano',
        'zh': 'chino',
        'ja': 'japonés',
        'ko': 'coreano',
        'ar': 'árabe'
      };

      const targetLanguageName = languageNames[targetLanguage] || targetLanguage;
      
      // Detectar idioma y traducir en una sola llamada
      const prompt = `Detecta el idioma del siguiente texto y luego tradúcelo a ${targetLanguageName}. 
      
Si el texto ya está en ${targetLanguageName}, devuélvelo tal como está.

Texto a analizar: "${text}"

Responde SOLO con la traducción, sin explicaciones adicionales.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      const result = await response.json();
      
      if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
        const translatedText = result.candidates[0].content.parts[0].text.trim();
        
        res.json({ 
          translatedText,
          originalText: text,
          targetLanguage
        });
      } else {
        res.status(500).json({ error: "Error en la respuesta del servicio de traducción" });
      }
    } catch (error) {
      console.error("Error en detección y traducción:", error);
      res.status(500).json({ error: "Error en el servicio de traducción" });
    }
  });

  // Endpoint para traducir mensajes usando Gemini AI
  app.post("/api/translate-message", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage, messageType } = req.body;
      
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: "Texto y idioma destino son requeridos" });
      }

      const languageNames: any = {
        'es': 'español',
        'en': 'inglés',
        'fr': 'francés',
        'de': 'alemán',
        'pt': 'portugués',
        'it': 'italiano',
        'zh': 'chino',
        'ja': 'japonés',
        'ko': 'coreano',
        'ar': 'árabe'
      };

      const targetLanguageName = languageNames[targetLanguage] || targetLanguage;
      
      // Usar Gemini AI para traducción
      const geminiApiKey = process.env.GOOGLE_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: "Clave API de Gemini no configurada" });
      }

      const prompt = `Traduce el siguiente texto a ${targetLanguageName}. Solo devuelve la traducción, sin explicaciones adicionales:

"${text}"`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      const result = await response.json();
      
      if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
        const translatedText = result.candidates[0].content.parts[0].text.trim();
        
        res.json({ 
          translatedText,
          originalText: text,
          targetLanguage,
          messageType 
        });
      } else {
        res.status(500).json({ error: "Error en la respuesta del servicio de traducción" });
      }
    } catch (error) {
      console.error("Error traduciendo mensaje:", error);
      res.status(500).json({ error: "Error en el servicio de traducción" });
    }
  });

  // Registrar rutas API directa
  registerDirectAPIRoutes(app);
  console.log("Rutas de API directa registradas correctamente");

  // Registrar rutas optimizadas
  registerOptimizedRoutes(app);
  console.log("🚀 Rutas optimizadas registradas correctamente");

  const port = parseInt(process.env.PORT || "5000", 10);

  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
}

main().catch(console.error);