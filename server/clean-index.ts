import express from 'express';
import cors from 'cors';
import { db } from './db';
import { whatsappAccounts, users } from '../shared/schema';
import { eq } from 'drizzle-orm';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

console.log('🚀 Iniciando sistema CRM WhatsApp limpio con IA (Gemini + OpenAI)');

// Basic routes for clean AI system
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Clean AI system running with Gemini and OpenAI support',
    timestamp: new Date().toISOString()
  });
});

// User authentication - simplified
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password required"
      });
    }
    
    // Simple admin access
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
    
    // Super admin access
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

// WhatsApp accounts
app.get('/api/whatsapp/accounts', async (req, res) => {
  try {
    const accounts = await db.select().from(whatsappAccounts);
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Error getting WhatsApp accounts:', error);
    res.status(500).json({ success: false, error: 'Failed to get accounts' });
  }
});

// Chat management
app.get('/api/whatsapp/chats', async (req, res) => {
  try {
    // Return empty chats - will be populated by WhatsApp service
    res.json({ success: true, chats: [] });
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ success: false, error: 'Failed to get chats' });
  }
});

// Messages
app.get('/api/whatsapp/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    // Return empty messages - will be populated by WhatsApp service
    res.json({ success: true, messages: [] });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ success: false, error: 'Failed to get messages' });
  }
});

// AI Settings
app.get('/api/settings/gemini-key-status', async (req, res) => {
  try {
    // Check if Gemini API key is configured
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

app.get('/api/settings/openai-key-status', async (req, res) => {
  try {
    // Check if OpenAI API key is configured
    const hasKey = !!process.env.OPENAI_API_KEY;
    res.json({
      hasValidKey: hasKey
    });
  } catch (error) {
    console.error('Error checking OpenAI key:', error);
    res.json({ hasValidKey: false });
  }
});

// AI Response Generation
app.post('/api/ai/generate-response', async (req, res) => {
  try {
    const { message, provider = 'gemini' } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    // Placeholder for AI response generation
    // Will be implemented with actual AI services
    res.json({
      success: true,
      response: `AI response generated using ${provider} for: ${message}`,
      provider
    });
    
  } catch (error) {
    console.error('Error generating AI response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI response'
    });
  }
});

// Users
app.get('/api/users/:id', async (req, res) => {
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

// Settings endpoints
app.post('/api/settings/ai', async (req, res) => {
  try {
    const settings = req.body;
    
    // Simulate saving AI settings
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

app.post('/api/settings/notifications', async (req, res) => {
  try {
    const settings = req.body;
    
    // Simulate saving notification settings
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

// Catch all external agent routes and redirect to AI settings
app.all('/api/external-*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'External agent functionality has been removed. Please use AI settings for Gemini or OpenAI configuration.',
    redirect: '/settings'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Clean CRM server running on port ${PORT}`);
  console.log(`🤖 AI providers available: Gemini, OpenAI`);
  console.log(`🚫 External agents disabled - clean system only`);
});

export default app;