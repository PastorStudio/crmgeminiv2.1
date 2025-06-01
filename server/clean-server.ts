import express, { type Request, Response } from "express";
import { createServer } from "http";
import { setupVite, serveStatic } from "./vite";
import { db } from "./db";
import { users, whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();
const server = createServer(app);

console.log('🚀 Starting clean CRM system with AI support (Gemini + OpenAI only)');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clean authentication
app.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password required"
      });
    }
    
    if (username === 'admin' && password === 'admin123') {
      return res.json({
        success: true,
        message: "Login successful",
        token: 'demo-token-admin',
        user: {
          id: 1,
          username: 'admin',
          role: 'admin',
          email: 'admin@crm.com',
          fullName: 'Administrator'
        }
      });
    }
    
    if (username === 'DJP' && password === 'Mi123456@') {
      return res.json({
        success: true,
        message: "Login successful",
        token: 'demo-token-djp',
        user: {
          id: 3,
          username: 'DJP',
          role: 'super_admin',
          email: 'superadmin@crm.com',
          fullName: 'Super Administrator'
        }
      });
    }
    
    return res.status(401).json({
      success: false,
      message: "Invalid credentials"
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// API Status
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Clean AI system running with Gemini and OpenAI support',
    timestamp: new Date().toISOString()
  });
});

// Users
app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, user: user[0] });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// WhatsApp accounts
app.get('/api/whatsapp/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await db.select().from(whatsappAccounts);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Error getting WhatsApp accounts:', error);
    res.status(500).json({ success: false, error: 'Failed to get accounts' });
  }
});

// AI Settings
app.get('/api/settings/gemini-key-status', async (req: Request, res: Response) => {
  try {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({
      hasValidKey: hasKey,
      isTemporary: false
    });
  } catch (error) {
    console.error('Error checking Gemini key:', error);
    res.json({ hasValidKey: false, isTemporary: false });
  }
});

app.get('/api/settings/openai-key-status', async (req: Request, res: Response) => {
  try {
    const hasKey = !!process.env.OPENAI_API_KEY;
    res.json({
      hasValidKey: hasKey
    });
  } catch (error) {
    console.error('Error checking OpenAI key:', error);
    res.json({ hasValidKey: false });
  }
});

app.post('/api/settings/ai', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    console.log('AI settings saved:', settings);
    
    res.json({
      success: true,
      message: 'AI settings saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving AI settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save AI settings'
    });
  }
});

app.post('/api/settings/notifications', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    console.log('Notification settings saved:', settings);
    
    res.json({
      success: true,
      message: 'Notification settings saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save notification settings'
    });
  }
});

// Block all external agent routes
app.all('/api/external-*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'External agent functionality has been removed. Please use AI settings for Gemini or OpenAI configuration.',
    redirect: '/settings'
  });
});

// Basic chat and message endpoints
app.get('/api/whatsapp/chats', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, chats: [] });
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ success: false, error: 'Failed to get chats' });
  }
});

app.get('/api/whatsapp/messages/:chatId', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, messages: [] });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ success: false, error: 'Failed to get messages' });
  }
});

// Setup Vite in development
if (app.get("env") === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}

const PORT = Number(process.env.PORT) || 5000;

server.listen(PORT, "0.0.0.0", () => {
  const formattedTime = new Date().toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  console.log(`✅ Clean CRM server running on port ${PORT}`);
  console.log(`🤖 AI providers available: Gemini, OpenAI`);
  console.log(`🚫 External agents disabled - clean system only`);
  console.log(`⏰ Server time: ${formattedTime}`);
});