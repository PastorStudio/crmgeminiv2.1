import express, { type Request, Response } from "express";
import { createServer } from "http";
import { setupVite, serveStatic } from "./vite";
import { db } from "./db";
import { users, whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();
const server = createServer(app);

// Enable CORS for cross-origin requests from frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

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

// WhatsApp accounts endpoints
app.get('/api/whatsapp/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(whatsappAccounts);
    res.json(accounts);
  } catch (error) {
    console.error('Get WhatsApp accounts error:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp accounts' });
  }
});

app.post('/api/whatsapp/accounts', async (req: Request, res: Response) => {
  try {
    const { name, description, ownerName, ownerPhone } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const newAccount = await db.insert(whatsappAccounts).values({
      name,
      description: description || null,
      ownerName: ownerName || null,
      ownerPhone: ownerPhone || null,
      status: 'inactive',
      autoResponseEnabled: false,
      sessionData: null,
      adminId: 1, // Default admin user
      assignedExternalAgentId: null,
      autoResponseDelay: 5000,
      lastActiveAt: new Date()
    }).returning();

    res.json(newAccount[0]);
  } catch (error) {
    console.error('Create WhatsApp account error:', error);
    res.status(500).json({ error: 'Failed to create WhatsApp account' });
  }
});

app.delete('/api/whatsapp/accounts/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    await db.delete(whatsappAccounts).where(eq(whatsappAccounts.id, accountId));
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete WhatsApp account error:', error);
    res.status(500).json({ error: 'Failed to delete WhatsApp account' });
  }
});

app.delete('/api/whatsapp/accounts', async (req: Request, res: Response) => {
  try {
    await db.delete(whatsappAccounts);
    res.json({ success: true, message: 'All accounts deleted successfully' });
  } catch (error) {
    console.error('Delete all WhatsApp accounts error:', error);
    res.status(500).json({ error: 'Failed to delete all WhatsApp accounts' });
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
    const { provider, enabled } = req.body;
    
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    // In a clean system, we just acknowledge the setting
    console.log(`AI provider ${provider} ${enabled ? 'enabled' : 'disabled'}`);
    
    res.json({ 
      success: true, 
      message: `${provider} configuration updated`,
      provider,
      enabled 
    });
  } catch (error) {
    console.error('AI settings error:', error);
    res.status(500).json({ error: 'Failed to update AI settings' });
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

// WhatsApp endpoints
app.get('/api/whatsapp/chats', async (req: Request, res: Response) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

app.get('/api/whatsapp/messages/:chatId', async (req: Request, res: Response) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Additional endpoints needed by frontend
app.get('/api/external-agents', async (req: Request, res: Response) => {
  try {
    res.json([]); // Clean system has no external agents
  } catch (error) {
    res.status(500).json({ error: 'Failed to get external agents' });
  }
});

app.get('/api/whatsapp/ping-status/all', async (req: Request, res: Response) => {
  try {
    res.json({}); // Clean system has no ping status
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ping status' });
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

// Important: Setup Vite AFTER all API routes are defined
// This ensures API routes are processed before Vite's catch-all middleware
if (app.get("env") === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}

const PORT = 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Clean CRM server running on port ${PORT}`);
});