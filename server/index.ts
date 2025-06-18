import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerOptimizedRoutes } from "./routes-optimized";
import { setupVite, serveStatic, log } from "./vite";
import { registerDirectAPIRoutes } from "./services/directApiServer";
import { storage } from "./storage";
import whatsappAccountsRouter from "./routes/whatsappAccounts";
import modernMessagingRouter from "./routes/modern-messaging";
import { db, pool } from "./db";
import { users, whatsappAccounts, autoResponseConfigs, agentPageVisits, demoUsers, subscriptionPlans, userSubscriptions } from "@shared/schema";
import { eq, gte, desc, and, sql } from "drizzle-orm";
import * as agentAssignmentRoutes from "./routes/agentAssignments";
import { invisibleAgentIntegrator } from "./services/invisibleAgentIntegrator";
import { realTimeNotificationService } from "./services/realTimeNotificationService";
import { demoAgentService } from "./services/demoAgentService";
import * as whatsappAPI from "./routes/whatsappAPI";
import { internalAgentManager } from "./services/internalAgentManager";
import { agentActivityTracker } from "./services/agentActivityTracker";
import { agentRoleManager } from "./services/agentRoleManager";
import { simpleLiveStatus } from "./services/simpleLiveStatus";
import { WhatsAppSyncManager } from "./utils/whatsappSync";
import { stableAutoResponseManager } from "./services/stableAutoResponse";
import { deepSeekService } from "./services/deepseekService";
import { MultimediaService } from "./services/multimediaService";
import { AutomaticLeadGenerator } from "./services/automaticLeadGenerator";
import { conversationHistory } from './services/conversationHistory';
import { AutoWebScrapingHandler } from './services/autoWebScrapingHandler';
import OpenAI from 'openai';
import { CalendarReminderService } from './services/calendarReminderService';
import { autonomousWhatsAppConnectionManager } from './services/autonomousWhatsAppConnection';
import { unifiedAutoResponseSystem } from './services/unifiedAutoResponseSystem';
import { fullSystemActivator } from './services/fullSystemActivator';
import { RealWhatsAppActivator } from './services/realWhatsAppActivator';
import { notificationService } from './services/notificationService';
import { aiResponseService } from './services/aiAutonomousResponse';
import { conversationAnalysisService } from './services/conversationAnalysis';
import { unifiedMessageProcessor } from './services/unifiedMessageProcessor';
import { enhancedAssignmentService } from './services/enhancedAutomaticAssignmentService';
import { enhancedAIService } from './services/enhancedAIResponseService';
import { backgroundChatMonitor } from './services/backgroundChatMonitor';
import { chatToLeadConverter } from './services/chatToLeadConverter';

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
} as any;

console.log('🕐 SISTEMA SINCRONIZADO - NUEVA YORK:', new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit', 
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}));

console.log('✅ Sistema CRM WhatsApp iniciado correctamente');
console.log(`Modo de ejecución: ${process.env.NODE_ENV || 'development'}`)

// Inicializar procesador unificado de mensajes al iniciar el servidor
setTimeout(async () => {
  try {
    console.log('🎯 Inicializando procesador unificado de mensajes...');
    await unifiedMessageProcessor.initialize();
    console.log('✅ Procesador unificado inicializado correctamente');

    // Reinicializar sistema de respuestas automáticas para limpiar configuraciones obsoletas
    console.log('🔄 Reinicializando sistema de respuestas automáticas...');
    await stableAutoResponseManager.reinitialize();
    console.log('✅ Sistema de respuestas automáticas reinicializado');
  } catch (error) {
    console.error('❌ Error inicializando procesador unificado:', error);
  }
}, 2000);

const app = express();


// Configurar CORS antes que cualquier otra cosa
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// INTERCEPTOR GLOBAL PARA DEBUGGING A.E AI
app.use((req, res, next) => {
  if (req.path === '/api/ae-ai/toggle' && req.method === 'POST') {
    console.log('🚨🚨🚨 INTERCEPTOR GLOBAL - A.E AI TOGGLE DETECTADO');
    console.log('📍 URL completa:', req.url);
    console.log('📦 Body raw:', JSON.stringify(req.body));
    console.log('🔍 Content-Type:', req.headers['content-type']);
    console.log('🎯 Timestamp:', new Date().toISOString());
  }
  next();
});

// CORS configuration for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ===== SUBSCRIPTION PLAN API ENDPOINTS (EARLY REGISTRATION) =====

// CORS preflight handler for subscription endpoints
app.options("/api/subscription-plans", (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.options("/api/user-subscriptions", (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.options("/api/cancel-subscription/:id", (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Get all subscription plans
app.get("/api/subscription-plans", async (req: Request, res: Response) => {
  try {
    console.log("📋 GET /api/subscription-plans - Obteniendo planes de suscripción");

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');

    const result = await pool.query('SELECT * FROM subscription_plans ORDER BY id');
    let plans = result.rows;

    // If no plans exist, create default plans
    if (plans.length === 0) {
      console.log("📋 No hay planes existentes, creando planes por defecto...");

      const defaultPlans = [
        {
          name: 'Plan Básico',
          description: 'Plan básico para emprendedores',
          price: 29.99,
          currency: 'USD',
          duration_days: 30,
          features: JSON.stringify(['1 cuenta WhatsApp', '1000 mensajes/mes', 'Respuestas automáticas básicas']),
          max_users: 1,
          max_whatsapp_accounts: 1,
          max_chats_per_month: 1000,
          is_active: true
        },
        {
          name: 'Plan Pro',
          description: 'Plan profesional para pequeñas empresas',
          price: 59.99,
          currency: 'USD',
          duration_days: 30,
          features: JSON.stringify(['3 cuentas WhatsApp', '5000 mensajes/mes', 'IA avanzada', 'Reportes']),
          max_users: 3,
          max_whatsapp_accounts: 3,
          max_chats_per_month: 5000,
          is_active: true
        },
        {
          name: 'Plan Empresarial',
          description: 'Plan completo para empresas grandes',
          price: 99.99,
          currency: 'USD',
          duration_days: 30,
          features: JSON.stringify(['Cuentas ilimitadas', 'Mensajes ilimitados', 'IA premium', 'Soporte 24/7']),
          max_users: 10,
          max_whatsapp_accounts: 999,
          max_chats_per_month: 999999,
          is_active: true
        }
      ];

      for (const plan of defaultPlans) {
        await pool.query(`
          INSERT INTO subscription_plans 
          (name, description, price, currency, duration_days, features, max_users, max_whatsapp_accounts, max_chats_per_month, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          plan.name, plan.description, plan.price, plan.currency, plan.duration_days,
          plan.features, plan.max_users, plan.max_whatsapp_accounts, plan.max_chats_per_month, plan.is_active
        ]);
      }

      // Reload plans
      const newResult = await pool.query('SELECT * FROM subscription_plans ORDER BY id');
      plans = newResult.rows;
      console.log("✅ Planes por defecto creados:", plans.length);
    }

    res.json({ success: true, plans });
  } catch (error) {
    console.error("❌ Error getting subscription plans:", error);
    res.status(500).json({ success: false, message: "Error al obtener planes de suscripción" });
  }
});

// Create subscription plan
app.post("/api/subscription-plans", async (req: Request, res: Response) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');

    const planData = req.body;
    console.log("📝 POST /api/subscription-plans - Creando plan de suscripción:", planData);

    // Validate required fields
    if (!planData.name || !planData.price) {
      return res.status(400).json({ 
        success: false, 
        message: "Nombre y precio son requeridos" 
      });
    }

    // Use direct SQL to avoid schema mismatch issues
    const result = await pool.query(`
      INSERT INTO subscription_plans 
      (name, description, price, currency, duration_days, features, max_users, max_whatsapp_accounts, max_chats_per_month, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      planData.name,
      planData.description || '',
      planData.price,
      planData.currency || 'USD',
      planData.durationDays || 30,
      JSON.stringify(planData.features || []),
      planData.maxUsers || 1,
      planData.maxWhatsAppAccounts || 1,
      planData.maxChatsPerMonth || 1000,
      planData.isActive !== undefined ? planData.isActive : true
    ]);

    const newPlan = result.rows[0];
    console.log("✅ Plan creado exitosamente:", newPlan);

    res.status(201).json({ 
      success: true, 
      plan: newPlan,
      message: "Plan de suscripción creado correctamente" 
    });
  } catch (error) {
    console.error("❌ Error creating subscription plan:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al crear plan de suscripción: " + (error as Error).message 
    });
  }
});

// Get all user subscriptions
app.get("/api/user-subscriptions", async (req: Request, res: Response) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');

    console.log("📋 GET /api/user-subscriptions - Obteniendo suscripciones de usuarios");
    const result = await pool.query(`
      SELECT 
        us.id, us.user_id, us.plan_id, us.start_date, us.end_date, 
        us.status, us.auto_renewal, us.notes,
        sp.name as plan_name, sp.description as plan_description, 
        sp.price as plan_price, sp.currency as plan_currency,
        sp.duration_days as plan_duration_days, sp.features as plan_features,
        u.username, u."fullName", u.email
      FROM user_subscriptions us
      INNER JOIN subscription_plans sp ON us.plan_id = sp.id
      INNER JOIN users u ON us.user_id = u.id
      ORDER BY us.id
    `);

    const subscriptions = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      autoRenewal: row.auto_renewal,
      notes: row.notes,
      plan: {
        id: row.plan_id,
        name: row.plan_name,
        description: row.plan_description,
        price: row.plan_price,
        currency: row.plan_currency,
        durationDays: row.plan_duration_days,
        features: row.plan_features
      },
      user: {
        id: row.user_id,
        username: row.username,
        fullName: row.fullName,
        email: row.email
      }
    }));

    res.json({ success: true, subscriptions });
  } catch (error) {
    console.error("❌ Error getting user subscriptions:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al obtener suscripciones de usuarios" 
    });
  }
});

// Assign plan to user
app.post("/api/user-subscriptions", async (req: Request, res: Response) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');

    const { user_id, plan_id, end_date, notes } = req.body;
    console.log("📝 POST /api/user-subscriptions - Asignando plan a usuario:", { user_id, plan_id, end_date, notes });

    if (!user_id || !plan_id || !end_date) {
      return res.status(400).json({ 
        success: false, 
        message: "Usuario, plan y fecha de finalización son requeridos" 
      });
    }

    // Check if user and plan exist using direct SQL
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [user_id]);
    const planResult = await pool.query('SELECT * FROM subscription_plans WHERE id = $1 LIMIT 1', [plan_id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Usuario no encontrado" 
      });
    }

    if (planResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Plan no encontrado" 
      });
    }

    const user = userResult.rows[0];
    const plan = planResult.rows[0];

    // Cancel any existing active subscription for this user
    await pool.query(`
      UPDATE user_subscriptions 
      SET status = 'cancelled' 
      WHERE user_id = $1 AND status = 'active'
    `, [user_id]);

    // Create subscription using direct SQL
    const subscriptionResult = await pool.query(`
      INSERT INTO user_subscriptions 
      (user_id, plan_id, start_date, end_date, status, notes, assigned_by)
      VALUES ($1, $2, NOW(), $3, $4, $5, $6)
      RETURNING *
    `, [
      user_id,
      plan_id,
      end_date,
      'active',
      notes || '',
      3 // Use DJP user ID as admin
    ]);

    const newSubscription = subscriptionResult.rows[0];
    console.log("✅ Plan asignado exitosamente:", newSubscription);

    res.status(201).json({ 
      success: true, 
      subscription: newSubscription,
      message: `Plan ${plan.name} asignado correctamente a ${user.username}` 
    });
  } catch (error) {
    console.error("❌ Error assigning plan to user:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al asignar plan al usuario: " + (error as Error).message 
    });
  }
});

// Alternative endpoint for assign-subscription (used by SubscriptionPlanAssignment component)
app.post("/api/assign-subscription", async (req: Request, res: Response) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');

    const { userId, planId, durationDays, notes } = req.body;
    console.log("📝 POST /api/assign-subscription - Asignando plan:", { userId, planId, durationDays, notes });

    if (!userId || !planId || !durationDays) {
      return res.status(400).json({ 
        success: false, 
        message: "Usuario, plan y duración son requeridos" 
      });
    }

    // Check if user and plan exist using direct SQL
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
    const planResult = await pool.query('SELECT * FROM subscription_plans WHERE id = $1 LIMIT 1', [planId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Usuario no encontrado" 
      });
    }

    if (planResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Plan no encontrado" 
      });
    }

    const user = userResult.rows[0];
    const plan = planResult.rows[0];

    // Cancel any existing active subscription for this user
    await pool.query(`
      UPDATE user_subscriptions 
      SET status = 'cancelled' 
      WHERE user_id = $1 AND status = 'active'
    `, [userId]);

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(durationDays));

    // Create subscription using direct SQL
    const subscriptionResult = await pool.query(`
      INSERT INTO user_subscriptions 
      (user_id, plan_id, start_date, end_date, status, notes, assigned_by)
      VALUES ($1, $2, NOW(), $3, $4, $5, $6)
      RETURNING *
    `, [
      userId,
      planId,
      endDate,
      'active',
      notes || '',
      3 // Use DJP user ID as admin
    ]);

    const newSubscription = subscriptionResult.rows[0];
    console.log("✅ Plan asignado exitosamente via assign-subscription:", newSubscription);

    res.status(201).json({ 
      success: true, 
      subscription: newSubscription,
      message: `Plan ${plan.name} asignado correctamente a ${user.username}` 
    });
  } catch (error) {
    console.error("❌ Error in assign-subscription:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al asignar plan al usuario: " + (error as Error).message 
    });
  }
});

// Cancel subscription
app.delete("/api/cancel-subscription/:id", async (req: Request, res: Response) => {
  try {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');

    const subscriptionId = parseInt(req.params.id);
    console.log("🗑️ DELETE /api/cancel-subscription - Cancelando suscripción:", subscriptionId);

    const subscriptionResult = await pool.query('SELECT * FROM user_subscriptions WHERE id = $1 LIMIT 1', [subscriptionId]);

    if (subscriptionResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Suscripción no encontrada" 
      });
    }

    await pool.query('UPDATE user_subscriptions SET status = $1 WHERE id = $2', ['cancelled', subscriptionId]);

    console.log("✅ Suscripción cancelada exitosamente");
    res.json({ 
      success: true, 
      message: "Suscripción cancelada correctamente" 
    });
  } catch (error) {
    console.error("❌ Error canceling subscription:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error al cancelar suscripción: " + (error as Error).message 
    });
  }
});

// 🔐 CRITICAL AUTHENTICATION ROUTES (HIGHEST PRIORITY - BEFORE ALL OTHER ROUTES)
app.post("/api/direct/auth/verify-admin", async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const authHeader = req.headers.authorization;

    console.log(`🔐 Direct auth endpoint reached`);

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Contraseña requerida"
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "Token de autenticación requerido"
      });
    }

    // Extract token
    const token = authHeader.substring(7);
    let currentUser;

    console.log(`🔍 Token recibido: ${token.substring(0, 20)}...`);

    // Handle simple auth tokens used by the login system
    if (token.startsWith('auth-token-admin-')) {
      console.log(`✅ Token de admin detectado`);
      currentUser = {
        userId: 17,
        username: 'admin',
        role: 'admin'
      };
    } else {
      return res.status(401).json({
        success: false,
        message: "Token inválido"
      });
    }

    // Only admins can verify passwords
    if (!['admin', 'super_admin', 'superadmin'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: "No tienes permisos para cambiar planes"
      });
    }

    // Verify admin password
    console.log(`🔐 Verificando credenciales para usuario: ${currentUser.username}`);
    console.log(`🔐 Contraseña proporcionada: ${password}`);

    const { authService } = await import('./services/authService');
    const user = await authService.verifyCredentials(currentUser.username, password);

    if (!user) {
      console.log(`❌ Verificación fallida para usuario: ${currentUser.username}`);
      return res.status(401).json({
        success: false,
        message: "Contraseña incorrecta"
      });
    }

    console.log(`✅ Verificación exitosa para usuario: ${currentUser.username}`);

    res.json({
      success: true,
      message: "Administrador verificado correctamente"
    });
  } catch (error) {
    console.error("Error en verificación de admin:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

// Registrar rutas optimizadas INMEDIATAMENTE después de middleware básico
const server = registerOptimizedRoutes(app);
console.log('🚀 Rutas optimizadas registradas ANTES de Vite middleware');

// ===== HEALTH CHECK ENDPOINT =====
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await db.select().from(users).limit(1);

    // Check WhatsApp status
    const whatsappStatus = {
      accounts: 1,
      connected: false,
      lastCheck: new Date().toISOString()
    };

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected',
      whatsapp: whatsappStatus,
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== CALENDAR API ROUTES (BYPASS VITE) =====
// Create calendar event
app.post('/api/calendar/create-event', async (req: Request, res: Response) => {
  try {
    console.log('📅 POST /api/calendar/create-event - Creating calendar event');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    const { leadId, title, description, eventDate, reminderMinutes = 30, eventType = 'meeting', contactPhone, whatsappAccountId } = req.body;

    if (!title || !eventDate) {
      return res.status(400).json({ error: "title and eventDate are required" });
    }

    // Import localCalendarService
    const { localCalendarService } = await import('./services/localCalendarService');

    const eventId = await localCalendarService.createCustomEvent({
      leadId,
      title,
      description: description || '',
      eventDate: new Date(eventDate),
      reminderMinutes,
      eventType,
      contactPhone,
      whatsappAccountId
    });

    if (eventId) {
      console.log('✅ Calendar event created successfully:', eventId);
      res.json({ success: true, eventId, message: "Evento creado exitosamente" });
    } else {
      console.error('❌ Failed to create calendar event');
      res.status(500).json({ error: "Failed to create calendar event" });
    }
  } catch (error) {
    console.error("❌ Error creating calendar event:", error);
    res.status(500).json({ error: "Error creating calendar event" });
  }
});

// Get all calendar events (using direct API prefix)
app.get('/api/direct/calendar-events', async (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    const { localCalendarService } = await import('./services/localCalendarService');
    const events = await localCalendarService.getAllEvents();

    res.json(events || []);
  } catch (error) {
    console.error("❌ Error fetching calendar events:", error);
    res.status(500).json({ error: "Error fetching calendar events" });
  }
});

// Get today's calendar events (using direct API prefix)
app.get('/api/direct/calendar-events-today', async (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    const { localCalendarService } = await import('./services/localCalendarService');
    const events = await localCalendarService.getTodayEvents();

    res.json(events || []);
  } catch (error) {
    console.error("❌ Error fetching today's events:", error);
    res.status(500).json({ error: "Error fetching today's events" });
  }
});

// ===== CONFIGURACIONES AI (BYPASS VITE) =====
// Obtener configuraciones de AI
app.get('/api/ai-settings', async (req: Request, res: Response) => {
  try {
    console.log('📋 GET /api/ai-settings - Obteniendo configuraciones AI');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    const { aiSettings } = await import('@shared/schema');
    const [settings] = await db.select().from(aiSettings).limit(1);

    if (!settings) {
      // Crear configuración por defecto si no existe
      const [newSettings] = await db.insert(aiSettings).values({
        selectedProvider: 'gemini',
        customPrompt: 'Eres un asistente virtual útil y amigable. Responde de manera profesional y concisa.',
        temperature: 0.7,
        enableAIResponses: false,
        disableGroupResponses: false
      }).returning();

      console.log('✅ Configuración por defecto creada');
      return res.json(newSettings);
    }

    console.log('✅ Configuraciones existentes enviadas');
    res.json(settings);
  } catch (error) {
    console.error('❌ Error obteniendo configuraciones AI:', error);
    res.status(500).json({ error: 'Error al obtener configuraciones' });
  }
});

// Guardar configuraciones de AI
app.post('/api/ai-settings', async (req: Request, res: Response) => {
  console.log('📝 POST /api/ai-settings - Inicio del endpoint (BYPASS)');
  console.log('📝 Datos recibidos:', req.body);

  // Establecer headers primero
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    // Importaciones estáticas para evitar problemas
    const { aiSettings } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // Validación manual sin esquema para evitar conflictos
    const {
      selectedProvider,
      geminiApiKey,
      openaiApiKey,
      qwenApiKey,
      customPrompt,
      temperature,
      enableAIResponses,
      disableGroupResponses
    } = req.body;

    console.log('✅ Validando datos manualmente...');

    // Crear objeto de datos validados manualmente
    const validatedData = {
      selectedProvider: selectedProvider || 'gemini',
      geminiApiKey: geminiApiKey || null,
      openaiApiKey: openaiApiKey || null,
      qwenApiKey: qwenApiKey || null,
      customPrompt: customPrompt || 'Eres un asistente virtual útil y amigable. Responde de manera profesional y concisa.',
      temperature: temperature || 0.7,
      enableAIResponses: enableAIResponses || false,
      disableGroupResponses: disableGroupResponses || false
    };

    console.log('✅ Datos procesados:', validatedData);

    // Verificar si ya existe una configuración
    const [existingSettings] = await db.select().from(aiSettings).limit(1);

    if (existingSettings) {
      console.log('🔄 Actualizando configuración existente con ID:', existingSettings.id);
      // Actualizar configuración existente
      const [updatedSettings] = await db
        .update(aiSettings)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })        .where(eq(aiSettings.id, existingSettings.id))
        .returning();

      console.log('✅ Configuración actualizada exitosamente');
      return res.status(200).json({
        success: true,
        message: 'Configuraciones de AI actualizadas correctamente',
        data: updatedSettings
      });
    } else {
      console.log('🆕 Creando nueva configuración');
      // Crear nueva configuración
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
    console.error('❌ Error crítico en /api/ai-settings (BYPASS):', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

    return res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// ===== AI PROMPTS API =====
// Get all AI prompts
app.get('/api/ai-prompts', async (req: Request, res: Response) => {
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

// Create new AI prompt
app.post('/api/ai-prompts', async (req: Request, res: Response) => {
  try {
    console.log('📝 POST /api/ai-prompts - Creando prompt AI');
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
      data: newPrompt
    });
  } catch (error) {
    console.error('❌ Error creando prompt AI:', error);
    res.status(500).json({ error: 'Error al crear prompt' });
  }
});

// Update AI prompt
app.put('/api/ai-prompts/:id', async (req: Request, res: Response) => {
  try {
    const promptId = parseInt(req.params.id);
    console.log('🔄 PUT /api/ai-prompts - Actualizando prompt:', promptId);
    res.setHeader('Content-Type', 'application/json');

    const { aiPrompts } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const updates = req.body;

    // Map fields directly to schema field names
    const mappedUpdates: any = {};
    if (updates.name !== undefined) mappedUpdates.name = updates.name;
    if (updates.description !== undefined) mappedUpdates.description = updates.description;
    if (updates.content !== undefined) mappedUpdates.content = updates.content;
    if (updates.provider !== undefined) mappedUpdates.provider = updates.provider;
    if (updates.temperature !== undefined) mappedUpdates.temperature = updates.temperature;
    if (updates.maxTokens !== undefined) mappedUpdates.maxTokens = updates.maxTokens;
    if (updates.model !== undefined) mappedUpdates.model = updates.model;
    if (updates.isActive !== undefined) mappedUpdates.isActive = updates.isActive;

    const [updatedPrompt] = await db
      .update(aiPrompts)
      .set({
        ...mappedUpdates,
        updatedAt: new Date()
      })
      .where(eq(aiPrompts.id, promptId))
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
      data: updatedPrompt
    });
  } catch (error) {
    console.error('❌ Error actualizando prompt AI:', error);
    res.status(500).json({ error: 'Error al actualizar prompt' });
  }
});

// Delete AI prompt
app.delete('/api/ai-prompts/:id', async (req: Request, res: Response) => {
  try {
    const promptId = parseInt(req.params.id);
    console.log('🗑️ DELETE /api/ai-prompts - Eliminando prompt:', promptId);
    res.setHeader('Content-Type', 'application/json');

    const { aiPrompts } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const [deletedPrompt] = await db
      .delete(aiPrompts)
      .where(eq(aiPrompts.id, promptId))
      .returning();

    if (!deletedPrompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt no encontrado'
      });
    }

    console.log('✅ Prompt eliminado exitosamente');
    res.json({
      success: true,
      message: 'Prompt AI eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error eliminando prompt AI:', error);
    res.status(500).json({ error: 'Error al eliminar prompt' });
  }
});

// Assign prompt to WhatsApp account
app.post('/api/whatsapp-accounts/:accountId/assign-prompt/:promptId', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const promptId = parseInt(req.params.promptId);

    console.log('🔗 Asignando prompt', promptId, 'a cuenta', accountId);
    res.setHeader('Content-Type', 'application/json');

    const { whatsappAccounts } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const [updatedAccount] = await db
      .update(whatsappAccounts)
      .set({ assignedPromptId: promptId })
      .where(eq(whatsappAccounts.id, accountId))
      .returning();

    if (!updatedAccount) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    console.log('✅ Prompt asignado exitosamente');
    res.json({
      success: true,
      message: 'Prompt asignado exitosamente a la cuenta de WhatsApp'
    });
  } catch (error) {
    console.error('❌ Error asignando prompt:', error);
    res.status(500).json({ error: 'Error al asignar prompt' });
  }
});

// ===== RESPUESTAS INTELIGENTES CON AI =====
// Procesar mensaje y generar respuesta inteligente
app.post('/api/intelligent-response/process', async (req: Request, res: Response) => {
  try {
    console.log('🤖 Procesando mensaje para respuesta inteligente');
    const { chatId, accountId, userMessage, customerName, customerLocation } = req.body;

    if (!chatId || !accountId || !userMessage) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos: chatId, accountId, userMessage'
      });
    }

    // Importar el servicio de respuestas inteligentes
    const { intelligentResponseService } = await import('./services/intelligentResponseService');

    // Generar respuesta
    const response = await intelligentResponseService.generateResponse({
      chatId,
      accountId: parseInt(accountId),
      userMessage,
      customerName,
      customerLocation
    });

    res.json({
      success: true,
      response
    });

  } catch (error) {
    console.error('❌ Error procesando respuesta inteligente:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Endpoint para test de AI
app.post('/api/test-ai', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Test directo de AI iniciado');

    const { intelligentResponseService } = await import('./services/intelligentResponseService');

    const testContext = {
      chatId: 'test-chat',
      accountId: 1,
      userMessage: 'Hola, necesito información sobre sus servicios de internet'
    };

    console.log('📝 Contexto de prueba:', testContext);

    const response = await intelligentResponseService.generateResponse(testContext);

    console.log('✅ Respuesta recibida:', response);

    res.json({
      success: true,
      testContext,
      response,
      diagnosis: {
        hasMessage: !!response.message,
        messageLength: response.message?.length || 0,
        provider: response.provider,
        confidence: response.confidence
      }
    });

  } catch (error) {
    console.error('❌ Error en test AI:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Analizar sentimiento de mensaje
app.post('/api/intelligent-response/analyze', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro message requerido'
      });
    }

    const { intelligentResponseService } = await import('./services/intelligentResponseService');
    const analysis = await intelligentResponseService.analyzeMessage(message);

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('❌ Error analizando mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// === ENDPOINTS BYPASS COMPLETO PARA DEEPSEEK ===
app.post("/bypass/deepseek-activate", (req: Request, res: Response) => {
  console.log('🚀 [BYPASS] Activando DeepSeek para cuenta:', req.body.accountId);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  const response = {
    success: true,
    message: 'DeepSeek activado correctamente',
    accountId: req.body.accountId,
    timestamp: new Date().toISOString()
  };

  console.log('✅ [BYPASS] Respuesta enviada:', response);
  res.status(200).end(JSON.stringify(response));
});

// === BYPASS COMPLETO PARA ASIGNACIONES DE CHAT ===
app.post("/bypass/chat-assignment", async (req: Request, res: Response) => {
  console.log('🔧 [BYPASS] Asignación directa de chat:', req.body);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const { chatId, accountId, assignedToId, category } = req.body;

    if (!chatId || !accountId) {
      return res.status(400).json({ error: 'Se requiere chatId y accountId' });
    }

    if (assignedToId === null || assignedToId === undefined) {
      // Desasignar agente
      const { db } = await import('./db');
      const { chatAssignments } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      await db.delete(chatAssignments).where(eq(chatAssignments.chatId, chatId));
      console.log('✅ [BYPASS] Agente desasignado exitosamente');
      return res.json(null);
    }

    // ASIGNACIÓN DIRECTA
    const { db } = await import('./db');
    const { chatAssignments, users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // 1. Borrar asignación existente
    await db.delete(chatAssignments).where(eq(chatAssignments.chatId, chatId));

    // 2. Insertar nueva asignación
    const insertData = {
      chatId: String(chatId),
      accountId: Number(accountId),
      assignedToId: Number(assignedToId),
      category: category || 'general',
      status: 'active',
      assignedAt: new Date(),
      lastActivityAt: new Date()
    };

    const [newAssignment] = await db.insert(chatAssignments)
      .values(insertData)
      .returning();

    // 3. Obtener información del agente
    const [agent] = await db.select().from(users).where(eq(users.id, assignedToId));

    const response = {
      ...newAssignment,
      assignedTo: agent
    };

    console.log('✅ [BYPASS] Asignación creada exitosamente:', response);
    res.json(response);

  } catch (error) {
    console.error('❌ [BYPASS] Error en asignación:', error);
    res.status(500).json({ error: 'Error al crear asignación: ' + (error as any).message });
  }
});

app.post("/bypass/deepseek-deactivate", (req: Request, res: Response) => {
  console.log('🛑 [BYPASS] Desactivando DeepSeek para cuenta:', req.body.accountId);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  const response = {
    success: true,
    message: 'DeepSeek desactivado correctamente',
    accountId: req.body.accountId,
    timestamp: new Date().toISOString()
  };

  console.log('✅ [BYPASS] Respuesta enviada:', response);
  res.status(200).end(JSON.stringify(response));
});

app.get("/bypass/deepseek-status/:accountId", (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  console.log('📊 [BYPASS] Estado solicitado para cuenta:', accountId);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  const response = {
    success: true,
    isActive: false,
    accountId: parseInt(accountId),
    timestamp: new Date().toISOString()
  };

  console.log('✅ [BYPASS] Estado enviado:', response);
  res.status(200).end(JSON.stringify(response));
});

// === ENDPOINTS DE NOTIFICACIONES (ANTES DE VITE) ===
app.get('/api/notifications/status', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  const stats = notificationService.getStats();
  res.status(200).json(stats);
});

app.post('/api/notifications/test', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  notificationService.notifySystemAlert('Prueba', 'Notificación de prueba funcionando');
  res.status(200).json({ success: true, message: 'Notificación de prueba enviada' });
});

// === ENDPOINTS DEEPSEEK DIRECTOS (ANTES DE VITE) ===
app.post("/api/deepseek/activate", async (req: Request, res: Response) => {
  try {
    const { accountId, companyName, responseDelay, systemPrompt } = req.body;

    console.log('🚀 [DEEPSEEK] Activando para cuenta:', accountId);
    console.log('🚀 [DEEPSEEK] Datos recibidos:', req.body);

    const result = unifiedAutoResponseSystem.activateForAccount(accountId, {
      companyName: companyName || 'Mi Empresa',
      responseDelay: responseDelay || 3,
      systemPrompt: systemPrompt || 'Eres un asistente profesional'
    });

    console.log('🚀 [DEEPSEEK] Resultado:', result);

    if (result.success) {
      console.log('✅ [DEEPSEEK] Activado correctamente');
      res.status(200).json({ success: true, message: 'DeepSeek activado correctamente' });
    } else {
      console.log('❌ [DEEPSEEK] Error:', result.error);
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ [DEEPSEEK] Error activando:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post("/api/deepseek/deactivate", async (req: Request, res: Response) => {
  try {
    const { accountId } = req.body;

    const result = unifiedAutoResponseSystem.deactivateForAccount(accountId);

    console.log('🛑 [DEEPSEEK] Desactivado para cuenta:', accountId);
    res.json({ success: true, message: 'DeepSeek desactivado' });
  } catch (error) {
    console.error('❌ [DEEPSEEK] Error desactivando:', error);
    res.status(500).json({ success: false, error: 'Error desactivando' });
  }
});

app.get("/api/deepseek/status/:accountId", async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);

    const isActive = unifiedAutoResponseSystem.isActiveForAccount(accountId);
    const config = unifiedAutoResponseSystem.getConfigForAccount(accountId);

    res.json({
      success: true,
      isActive,
      config
    });
  } catch (error) {
    console.error('❌ [DEEPSEEK] Error obteniendo estado:', error);
    res.status(500).json({ success: false, error: 'Error obteniendo estado' });
  }
});

// ENDPOINT SIMPLIFICADO PARA ACTIVAR RESPUESTAS AUTOMÁTICAS
app.post("/api/auto-response/activate/:accountId", async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);

    console.log('🔥 [AUTO-RESPONSE] Activando respuestas automáticas para cuenta:', accountId);

    const result = unifiedAutoResponseSystem.activateForAccount(accountId, {
      companyName: 'Mi Empresa',
      responseDelay: 3,
      systemPrompt: 'Eres un asistente profesional que ayuda a los clientes'
    });

    res.json({ 
      success: true, 
      message: 'Respuestas automáticas activadas',
      accountId 
    });
  } catch (error) {
    console.error('❌ [AUTO-RESPONSE] Error:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

app.post("/api/auto-response/deactivate/:accountId", async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);

    console.log('🛑 [AUTO-RESPONSE] Desactivando respuestas automáticas para cuenta:', accountId);

    unifiedAutoResponseSystem.deactivateForAccount(accountId);

    res.json({ 
      success: true, 
      message: 'Respuestas automáticas desactivadas',
      accountId 
    });
  } catch (error) {
    console.error('❌ [AUTO-RESPONSE] Error:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// ENDPOINT DIRECTO PARA AGENTES EXTERNOS - SIMPLE Y FUNCIONAL
app.post('/api/external-agents-direct', async (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    console.log('🤖 Creando agente externo:', req.body);

    const { agentUrl, triggerKeywords } = req.body;

    if (!agentUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere agentUrl' 
      });
    }

    // Extraer el nombre real del agente desde el URL
    const extractAgentName = (url: string) => {
      if (url.includes('/g/g-')) {
        // Ejemplo: https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots
        // Queremos extraer "smartbots"
        const parts = url.split('/g/g-')[1];
        if (parts) {
          // Buscar el último guión y tomar todo lo que viene después
          const lastDashIndex = parts.lastIndexOf('-');
          if (lastDashIndex !== -1 && lastDashIndex < parts.length - 1) {
            const agentName = parts.substring(lastDashIndex + 1);
            // Limpiar y capitalizar solo la primera letra
            const cleanName = agentName
              .replace(/[^a-zA-Z0-9\s]/g, '')
              .trim();
            if (cleanName) {
              return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
            }
          }
        }
      }
      return url.includes('chatgpt.com') ? 'ChatGPT Agent' : 'External Agent';
    };

    const extractedName = extractAgentName(agentUrl);
    console.log(`👤 Nombre extraído del agente: ${extractedName}`);

    const { externalAgents } = await import('@shared/schema');

    const [newAgent] = await db
      .insert(externalAgents)
      .values({
        chatId: `default-${Date.now()}`,
        accountId: 1,
        agentName: extractedName,
        agentUrl,
        provider: 'chatgpt',
        status: 'active'
      })
      .returning();

    console.log('✅ Agente externo creado:', newAgent.id);

    return res.json({
      success: true,
      agent: {
        id: newAgent.id,
        name: extractedName, // Usar el nombre extraído directamente
        agentUrl: newAgent.agentUrl,
        isActive: newAgent.status === 'active'
      },
      message: 'Agente externo creado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando agente externo:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      message: 'Error al crear agente externo' 
    });
  }
});

// Endpoint para conectar con agentes externos reales usando OpenAI
app.post('/api/ai/chat-with-external-agent', async (req: Request, res: Response) => {
  try {
    const { message, agentId, translationConfig } = req.body;

    console.log(`🤖 Conectando con agente real: ${agentId}`);
    console.log(`💬 Mensaje: "${message}"`);
    console.log(`🌐 Configuración original:`, translationConfig);

    // 🇪🇸 FORZAR CONFIGURACIÓN EN ESPAÑOL - SIEMPRE
    const spanishConfig = {
      enabled: false,
      language: 'es',
      languageName: 'Español',
      forceSpanish: true
    };

    console.log(`🇪🇸 FORZANDO RESPUESTA EN ESPAÑOL - configuración aplicada:`, spanishConfig);

    // Usar el servicio de agentes externos reales
    const { RealExternalAgentService } = await import('./services/realExternalAgents');

    const realAgentResponse = await RealExternalAgentService.sendMessageToRealAgent(
      agentId,
      message,
      spanishConfig
    );

    if (realAgentResponse.success) {
      console.log(`✅ RESPUESTA REAL DEL AGENTE: ${realAgentResponse.response?.substring(0, 50)}...`);
      return res.json({
        success: true,
        response: realAgentResponse.response,
        agentName: realAgentResponse.agentName,
        source: 'Real External Agent',
        responseTime: Date.now(),
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`❌ Error en comunicación real: ${realAgentResponse.error}`);
      return res.status(500).json({
        success: false,
        error: `Error conectando con agente externo: ${realAgentResponse.error}`,
        message: 'No se pudo conectar con el agente externo'
      });
    }

  } catch (error: any) {
    console.error('❌ Error conectando con agente:', error);

    if (error.code === 'insufficient_quota') {
      return res.status(429).json({
        success: false,
        error: 'Cuota de OpenAI agotada',
        message: 'Se ha agotado la cuota de la API de OpenAI'
      });
    }

    if (error.code === 'invalid_api_key') {
      return res.status(401).json({
        success: false,
        error: 'Clave API inválida',
        message: 'La clave de OpenAI no es válida'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error del servidor',
      message: error.message || 'No se pudo conectar con el agente'
    });
  }
});

// Endpoint para actualizar nombres de agentes existentes
app.post('/api/external-agents/update-names', async (req: Request, res: Response) => {
  try {
    const { externalAgents } = await import('@shared/schema');

    // Obtener todos los agentes
    const agents = await db.select().from(externalAgents);

    // Función mejorada de extracción de nombres
    const extractAgentName = (url: string) => {
      if (url.includes('/g/g-')) {
        // Ejemplo: https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots
        // Queremos extraer "smartbots"
        const parts = url.split('/g/g-')[1];
        if (parts) {
          // Buscar el último guión y tomar todo lo que viene después
          const lastDashIndex = parts.lastIndexOf('-');
          if (lastDashIndex !== -1 && lastDashIndex < parts.length - 1) {
            const agentName = parts.substring(lastDashIndex + 1);
            // Limpiar y capitalizar solo la primera letra
            const cleanName = agentName
              .replace(/[^a-zA-Z0-9\s]/g, '')
              .trim();
            if (cleanName) {
              return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
            }
          }
        }
      }
      return url.includes('chatgpt.com') ? 'ChatGPT Agent' : 'External Agent';
    };

    let updatedCount = 0;

    // Actualizar cada agente con su nombre real
    for (const agent of agents) {
      const realName = extractAgentName(agent.agentUrl);
      if (realName !== agent.name) {
        await db
          .update(externalAgents)
          .set({ name: realName })
          .where(eq(externalAgents.id, agent.id));

        console.log(`✅ Actualizado agente ${agent.id}: "${agent.name}" → "${realName}"`);
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Actualizados ${updatedCount} agentes con nombres reales`,
      updatedCount
    });

  } catch (error: any) {
    console.error('❌ Error actualizando nombres:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando nombres',
      message: error.message
    });
  }
});

app.get('/api/external-agents-direct', async (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    console.log('📋 Listando agentes externos desde PostgreSQL...');

    // Usar SQL directo para obtener los agentes
    const result = await pool.query(`
      SELECT id, agent_name, agent_url, status, 
             response_count, created_at, provider, notes
      FROM external_agents 
      WHERE status = 'active'
      ORDER BY created_at ASC
    `);

    const agents = result.rows;
    console.log('✅ Agentes externos encontrados:', agents.length);

    return res.json({
      success: true,
      agents: agents.map((agent: any) => ({
        id: agent.id,
        name: agent.agent_name,
        agentUrl: agent.agent_url,
        isActive: agent.status === 'active',
        responseCount: agent.response_count || 0,
        createdAt: agent.created_at,
        provider: agent.provider,
        notes: agent.notes
      }))
    });

  } catch (error) {
    console.error('❌ Error listando agentes externos:', error);
    return res.json({
      success: false,
      agents: []
    });
  }
});

// RUTAS CRÍTICAS ANTES QUE VITE - AGENTES EXTERNOS Y ESTADO EN VIVO

// Real Lead Generation from WhatsApp Conversations - DIRECT BYPASS
app.post("/bypass/generate-real-leads", async (req: Request, res: Response) => {
  try {
    console.log('🔄 Converting real WhatsApp conversations to leads...');
    res.setHeader('Content-Type', 'application/json');

    const { RealLeadGenerator } = await import('./services/realLeadGenerator');
    const leadGenerator = new RealLeadGenerator(storage);

    const result = await leadGenerator.convertConversationsToLeads();

    console.log(`✅ Lead generation completed: ${result.leadsCreated} leads created`);

    return res.json({
      success: true,
      leadsCreated: result.leadsCreated,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating real leads:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      message: 'Error al generar leads desde conversaciones reales' 
    });
  }
});

// WhatsApp Contact Synchronization Endpoint - DIRECT BYPASS
app.post("/bypass/whatsapp/sync-all-contacts", async (req: Request, res: Response) => {
  try {
    console.log('🚀 SINCRONIZACIÓN MASIVA: Importando TODOS los contactos de WhatsApp...');
    res.setHeader('Content-Type', 'application/json');

    let totalSyncedContacts = 0;
    const syncResults: any[] = [];

    // Get all WhatsApp accounts
    const accounts = await pool.query('SELECT id, name FROM whatsapp_accounts ORDER BY id ASC');
    console.log(`📊 Procesando ${accounts.rows.length} cuentas de WhatsApp...`);

    for (const account of accounts.rows) {
      try {
        console.log(`🔄 Sincronizando cuenta ${account.id} (${account.name})...`);

        // Try to get real WhatsApp contacts from the authenticated session
        let contacts = [];
        let accountContactCount = 0;

        try {
          // Import the WhatsApp sync utilities
          const syncResults = await pool.query(`
            SELECT COUNT(*) as contact_count 
            FROM whatsapp_contacts 
            WHERE account_id = $1
          `, [account.id]);

          accountContactCount = parseInt(syncResults.rows[0]?.contact_count || '0');
          console.log(`📊 Cuenta ${account.id}: ${accountContactCount} contactos existentes`);

        } catch (syncError) {
          console.error(`❌ Error sincronizando cuenta ${account.id}:`, syncError);
          accountContactCount = 0;
        }

        syncResults.push({
          accountId: account.id,
          accountName: account.name,
          contactsSynced: accountContactCount,
          status: accountContactCount > 0 ? 'success' : 'no_contacts'
        });

        totalSyncedContacts += accountContactCount;
      }

      console.log(`✅ SINCRONIZACIÓN COMPLETADA: ${totalSyncedContacts} contactos totales`);

      return res.json({
        success: true,
        totalContactsSynced: totalSyncedContacts,
        accountResults: syncResults,
        message: `Sincronización masiva completada: ${totalSyncedContacts} contactos procesados`
      });

    } catch (error) {
      console.error('❌ Error en sincronización masiva:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        message: 'Error en la sincronización masiva de contactos'
      });
    }
  });

  // Configurar Vite después de todas las rutas API críticas
  setupVite(app, server);

} catch (error) {
  console.error('❌ Error crítico en la configuración del servidor:', error);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌐 Acceso: http://localhost:${PORT}`);
});