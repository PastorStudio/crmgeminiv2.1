import express, { type Request, Response } from "express";
import cors from "cors";
import { db } from "./db";
import { users, whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

console.log("🚀 Starting API server on port 5001");

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
app.get('/users/:id', async (req: Request, res: Response) => {
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

    res.json({ 
      id: user[0].id, 
      username: user[0].username,
      role: user[0].role 
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// WhatsApp accounts endpoints
app.get('/whatsapp/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(whatsappAccounts);
    console.log('API Server: Retrieved', accounts.length, 'accounts');
    res.json(accounts);
  } catch (error) {
    console.error('Get WhatsApp accounts error:', error);
    res.status(500).json({ error: 'Failed to get WhatsApp accounts' });
  }
});

app.post('/whatsapp/accounts', async (req: Request, res: Response) => {
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
      adminId: 1,
      assignedExternalAgentId: null,
      autoResponseDelay: 5000,
      lastActiveAt: new Date()
    }).returning();

    console.log('API Server: Created new account:', newAccount[0]);
    res.json(newAccount[0]);
  } catch (error) {
    console.error('Create WhatsApp account error:', error);
    res.status(500).json({ error: 'Failed to create WhatsApp account' });
  }
});

app.delete('/whatsapp/accounts/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    await db.delete(whatsappAccounts).where(eq(whatsappAccounts.id, accountId));
    console.log('API Server: Deleted account', accountId);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete WhatsApp account error:', error);
    res.status(500).json({ error: 'Failed to delete WhatsApp account' });
  }
});

app.delete('/whatsapp/accounts', async (req: Request, res: Response) => {
  try {
    await db.delete(whatsappAccounts);
    console.log('API Server: Deleted all accounts');
    res.json({ success: true, message: 'All accounts deleted successfully' });
  } catch (error) {
    console.error('Delete all WhatsApp accounts error:', error);
    res.status(500).json({ error: 'Failed to delete all WhatsApp accounts' });
  }
});

// AI Settings endpoints
app.get('/settings/gemini-key-status', async (req: Request, res: Response) => {
  try {
    const hasValidKey = !!process.env.GEMINI_API_KEY;
    console.log('API Server: Gemini key status check:', hasValidKey ? 'FOUND' : 'NOT FOUND');
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

app.get('/settings/openai-key-status', async (req: Request, res: Response) => {
  try {
    const hasValidKey = !!process.env.OPENAI_API_KEY;
    console.log('API Server: OpenAI key status check:', hasValidKey ? 'FOUND' : 'NOT FOUND');
    res.json({
      hasValidKey,
      provider: 'openai'
    });
  } catch (error) {
    console.error('OpenAI key status error:', error);
    res.status(500).json({ error: 'Failed to get OpenAI key status' });
  }
});

app.post('/settings/ai', async (req: Request, res: Response) => {
  try {
    const { provider, enabled } = req.body;
    
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    console.log(`API Server: AI provider ${provider} ${enabled ? 'enabled' : 'disabled'}`);
    
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

app.post('/settings/notifications', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    console.log('API Server: Notification settings updated:', settings);
    res.json({ success: true, message: 'Notification settings updated' });
  } catch (error) {
    console.error('Notification settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// Additional endpoints
app.get('/external-agents', async (req: Request, res: Response) => {
  try {
    res.json([]); // Clean system has no external agents
  } catch (error) {
    res.status(500).json({ error: 'Failed to get external agents' });
  }
});

app.get('/whatsapp/ping-status/all', async (req: Request, res: Response) => {
  try {
    res.json({}); // Clean system has no ping status
  } catch (error) {
    res.status(500).json({ error: 'Failed to get ping status' });
  }
});

app.get('/whatsapp/chats', async (req: Request, res: Response) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

app.get('/whatsapp/messages/:chatId', async (req: Request, res: Response) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

app.get('/dashboard-stats', async (req: Request, res: Response) => {
  try {
    res.json({
      totalLeads: 0,
      activeChats: 0,
      responseRate: 0,
      avgResponseTime: 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    system: 'clean-crm-api',
    features: ['gemini-ai', 'openai-ai']
  });
});

const PORT = 5001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 API server running on port ${PORT}`);
});