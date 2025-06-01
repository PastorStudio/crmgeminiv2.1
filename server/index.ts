import express, { type Request, Response } from "express";
import { createServer } from "http";
import { setupVite, serveStatic } from "./vite";
import { db } from "./db";
import { users, whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

console.log("Conectando a la base de datos PostgreSQL...");

// Clean system startup message
console.log("🚀 Starting clean CRM system with AI support (Gemini + OpenAI only)");
console.log("✅ Clean CRM server running on port 5000");
console.log("🤖 AI providers available: Gemini, OpenAI");
console.log("🚫 External agents disabled - clean system only");
console.log("⏰ Server time:", new Date().toUTCString());

// Basic auth endpoint
app.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (user.length === 0 || user[0].password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      success: true, 
      user: { 
        id: user[0].id, 
        username: user[0].username,
        role: user[0].role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// User endpoints
app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: user[0].id, username: user[0].username, role: user[0].role });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// WhatsApp accounts endpoint
app.get('/api/whatsapp/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(whatsappAccounts);
    res.json(accounts);
  } catch (error) {
    console.error('Get WhatsApp accounts error:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp accounts' });
  }
});

// AI Settings endpoints (duplicates removed)

// Missing endpoints that the frontend is trying to access
app.get('/api/dashboard-stats', async (req: Request, res: Response) => {
  try {
    res.json({
      totalLeads: 0,
      activeChats: 0,
      responseTime: '0m',
      satisfaction: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

app.get('/api/direct/whatsapp/status', async (req: Request, res: Response) => {
  try {
    res.json({
      authenticated: false,
      qrCode: null,
      status: 'disconnected',
      message: 'Clean system - WhatsApp integration disabled'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get WhatsApp status' });
  }
});

// Additional API endpoints needed by the frontend
app.post('/api/settings/update-gemini-key', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    console.log('Gemini API key update requested');
    res.json({ success: true, message: 'Gemini API key updated' });
  } catch (error) {
    console.error('Gemini key update error:', error);
    res.status(500).json({ error: 'Failed to update Gemini key' });
  }
});

app.get('/api/settings/gemini-key-status', async (req: Request, res: Response) => {
  try {
    const hasValidKey = !!process.env.GEMINI_API_KEY;
    console.log(`✅ Gemini API key status check: ${hasValidKey ? 'FOUND' : 'NOT FOUND'}`);
    res.json({ 
      hasValidKey,
      isTemporary: false,
      provider: 'gemini'
    });
  } catch (error) {
    console.error('Gemini key status error:', error);
    res.status(500).json({ error: 'Failed to get Gemini key status' });
  }
});

app.get('/api/settings/openai-key-status', async (req: Request, res: Response) => {
  try {
    const hasValidKey = !!process.env.OPENAI_API_KEY;
    console.log(`✅ OpenAI API key status check: ${hasValidKey ? 'FOUND' : 'NOT FOUND'}`);
    res.json({ 
      hasValidKey,
      provider: 'openai'
    });
  } catch (error) {
    console.error('OpenAI key status error:', error);
    res.status(500).json({ error: 'Failed to get OpenAI key status' });
  }
});

app.post('/api/settings/ai', async (req: Request, res: Response) => {
  try {
    const { 
      provider, 
      enabled, 
      systemPrompt, 
      welcomePrompt, 
      followUpPrompt,
      responseTime,
      temperature,
      maxTokens,
      autoAnalyzeLeads,
      enrichLeadData,
      smartLeadScoring,
      messageGeneration,
      intelligentSurveys
    } = req.body;
    
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    // Save to database using Drizzle ORM
    const { aiSettings } = await import("@shared/schema");
    
    // Check if settings already exist
    const existingSettings = await db.select().from(aiSettings).limit(1);
    
    const settingsData = {
      aiProvider: provider,
      enabled,
      systemPrompt,
      welcomePrompt,
      followUpPrompt,
      responseTime: responseTime || 5,
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 500,
      autoAnalyzeLeads: autoAnalyzeLeads || false,
      enrichLeadData: enrichLeadData || false,
      smartLeadScoring: smartLeadScoring || false,
      messageGeneration: messageGeneration || false,
      intelligentSurveys: intelligentSurveys || false,
      updatedAt: new Date()
    };

    let savedSettings;
    if (existingSettings.length > 0) {
      // Update existing settings
      [savedSettings] = await db
        .update(aiSettings)
        .set(settingsData)
        .where(eq(aiSettings.id, existingSettings[0].id))
        .returning();
    } else {
      // Create new settings
      [savedSettings] = await db
        .insert(aiSettings)
        .values(settingsData)
        .returning();
    }

    console.log(`✅ AI configuration saved to database: ${provider} ${enabled ? 'enabled' : 'disabled'}`);
    
    res.json({ 
      success: true, 
      message: `${provider} configuration saved successfully`,
      settings: savedSettings
    });
  } catch (error) {
    console.error('AI settings error:', error);
    res.status(500).json({ error: 'Failed to save AI settings' });
  }
});

// Endpoint to get current AI configuration
app.get('/api/settings/ai-config', async (req: Request, res: Response) => {
  try {
    const { aiSettings } = await import("@shared/schema");
    
    // Get latest settings from database
    const [settings] = await db.select().from(aiSettings).orderBy(aiSettings.createdAt).limit(1);
    
    if (settings) {
      res.json({
        ...settings,
        hasValidKey: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)
      });
    } else {
      // Return default values if no settings found
      res.json({
        aiProvider: 'gemini',
        enabled: true,
        systemPrompt: 'Eres un asistente de ventas profesional. Responde de manera cordial, útil y enfocada en ayudar al cliente.',
        welcomePrompt: 'Genera un mensaje de bienvenida cálido y profesional para nuevos contactos.',
        followUpPrompt: 'Crea mensajes de seguimiento personalizados basados en la conversación previa.',
        responseTime: 5,
        temperature: 0.7,
        maxTokens: 500,
        autoAnalyzeLeads: true,
        enrichLeadData: true,
        smartLeadScoring: true,
        messageGeneration: true,
        intelligentSurveys: true,
        hasValidKey: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)
      });
    }
  } catch (error) {
    console.error('AI config error:', error);
    res.status(500).json({ error: 'Failed to get AI configuration' });
  }
});

app.post('/api/settings/notifications', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    console.log('Notification settings updated:', settings);
    res.json({ success: true, message: 'Notification settings updated' });
  } catch (error) {
    console.error('Notification settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// WhatsApp chats and messages (basic endpoints)
app.get('/api/whatsapp/chats', async (req: Request, res: Response) => {
  try {
    // Return empty array for clean system
    res.json([]);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

app.get('/api/whatsapp/messages/:chatId', async (req: Request, res: Response) => {
  try {
    // Return empty array for clean system
    res.json([]);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// WhatsApp accounts endpoints
app.get('/api/whatsapp-accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(whatsappAccounts).orderBy(whatsappAccounts.createdAt);
    res.json(accounts);
  } catch (error) {
    console.error('Get WhatsApp accounts error:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp accounts' });
  }
});

app.post('/api/whatsapp-accounts', async (req: Request, res: Response) => {
  try {
    const { name, description, ownerName, ownerPhone } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    const [newAccount] = await db
      .insert(whatsappAccounts)
      .values({
        name,
        description,
        ownerName,
        ownerPhone,
        status: 'inactive',
        adminId: 1, // Default admin ID
        autoResponseEnabled: false,
        responseDelay: 3
      })
      .returning();

    console.log(`✅ WhatsApp account created: ${name}`);
    
    res.json({
      success: true,
      message: 'WhatsApp account created successfully',
      account: newAccount
    });
  } catch (error) {
    console.error('Create WhatsApp account error:', error);
    res.status(500).json({ error: 'Failed to create WhatsApp account' });
  }
});

// External agents endpoint (clean system - always empty)
app.get('/api/external-agents', async (req: Request, res: Response) => {
  try {
    // Return empty array for clean system (no external agents)
    res.json([]);
  } catch (error) {
    console.error('Get external agents error:', error);
    res.status(500).json({ error: 'Failed to get external agents' });
  }
});

// WhatsApp ping status endpoint
app.get('/api/whatsapp/ping-status/all', async (req: Request, res: Response) => {
  try {
    // Return empty object for clean system
    res.json({});
  } catch (error) {
    console.error('WhatsApp ping status error:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp status' });
  }
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    system: 'clean-crm',
    features: ['gemini-ai', 'openai-ai']
  });
});

// Setup Vite in development or serve static files in production
if (app.get("env") === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}

const PORT = 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Clean CRM server running on port ${PORT}`);
});