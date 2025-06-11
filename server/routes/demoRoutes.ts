/**
 * Demo-specific routes with complete data isolation
 * Each demo user can only access their own WhatsApp accounts, messages, and data
 */

import { Router } from 'express';
import { db } from '../db';
import { whatsappAccounts, userAccountAssignments, whatsappMessages, demoUsers } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ensureDemoDataIsolation, filterDataForDemoUser, getDemoUserStats } from '../middleware/demoDataIsolation';

const router = Router();

// Apply demo data isolation middleware to all routes
router.use(ensureDemoDataIsolation);

/**
 * Get demo user's isolated WhatsApp accounts
 */
router.get('/whatsapp/accounts', async (req: any, res) => {
  try {
    console.log(`📱 Obteniendo cuentas WhatsApp para usuario demo: ${req.user?.username}`);

    if (req.user?.role !== 'demo') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado: Solo usuarios demo pueden acceder a esta ruta'
      });
    }

    // Get user's assigned accounts
    const userAccounts = await db.select({
      accountId: userAccountAssignments.whatsappAccountId
    })
    .from(userAccountAssignments)
    .where(and(
      eq(userAccountAssignments.userId, req.user.id),
      eq(userAccountAssignments.isActive, true)
    ));

    const assignedAccountIds = userAccounts.map(ua => ua.accountId);

    // Get owned accounts
    const ownedAccounts = await db.select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.userId, req.user.id));

    const ownedAccountIds = ownedAccounts.map(acc => acc.id);

    // Combine and get full account details
    const allAllowedIds = [...new Set([...assignedAccountIds, ...ownedAccountIds])];
    
    if (allAllowedIds.length === 0) {
      return res.json({
        success: true,
        accounts: [],
        message: 'No hay cuentas WhatsApp asignadas'
      });
    }

    const accounts = await db.select()
      .from(whatsappAccounts)
      .where(inArray(whatsappAccounts.id, allAllowedIds));

    console.log(`✅ ${accounts.length} cuentas encontradas para usuario demo ${req.user.username}`);

    res.json({
      success: true,
      accounts: accounts.map(account => ({
        id: account.id,
        name: account.name,
        description: account.description,
        status: account.status,
        autoResponseEnabled: account.autoResponseEnabled,
        responseDelay: account.responseDelay,
        customPrompt: account.customPrompt,
        targetLanguage: account.targetLanguage,
        translateToSpanish: account.translateToSpanish,
        lastActivity: account.lastActivity,
        createdAt: account.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo cuentas demo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Get isolated chats for demo user's account
 */
router.get('/whatsapp-accounts/:accountId/chats', async (req: any, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    // Verify access to this account
    if (!req.user?.allowedAccountIds?.includes(accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado a esta cuenta'
      });
    }

    // For demo users, return simulated chat data specific to their account
    const demoChats = [
      {
        id: `demo_chat_${accountId}_1`,
        name: 'Cliente Demo 1',
        isGroup: false,
        timestamp: Date.now() / 1000,
        unreadCount: 2,
        lastMessage: 'Hola, necesito información sobre sus servicios',
        accountId: accountId,
        isOnline: true,
        profilePicUrl: null
      },
      {
        id: `demo_chat_${accountId}_2`,
        name: 'Soporte Técnico Demo',
        isGroup: false,
        timestamp: (Date.now() - 300000) / 1000, // 5 minutes ago
        unreadCount: 0,
        lastMessage: 'Gracias por la información',
        accountId: accountId,
        isOnline: false,
        profilePicUrl: null
      },
      {
        id: `demo_chat_${accountId}_3`,
        name: 'Grupo Demo Ventas',
        isGroup: true,
        timestamp: (Date.now() - 600000) / 1000, // 10 minutes ago
        unreadCount: 1,
        lastMessage: 'Nueva oportunidad de venta',
        accountId: accountId,
        isOnline: false,
        profilePicUrl: null
      }
    ];

    console.log(`📊 Enviando ${demoChats.length} chats demo para cuenta ${accountId}`);

    res.json({
      success: true,
      chats: demoChats
    });

  } catch (error) {
    console.error('❌ Error obteniendo chats demo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Get isolated messages for demo user's chat
 */
router.get('/whatsapp-accounts/:accountId/messages/:chatId', async (req: any, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const chatId = req.params.chatId;

    // Verify access to this account
    if (!req.user?.allowedAccountIds?.includes(accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado a esta cuenta'
      });
    }

    // Generate demo messages for this specific chat
    const demoMessages = [
      {
        id: `msg_${chatId}_1`,
        body: 'Hola, ¿cómo están? Necesito información sobre sus servicios.',
        fromMe: false,
        timestamp: (Date.now() - 600000) / 1000, // 10 minutes ago
        hasMedia: false,
        type: 'text',
        chatId: chatId,
        author: null,
        authorProfilePic: null,
        authorNumber: '+1234567890'
      },
      {
        id: `msg_${chatId}_2`,
        body: '¡Hola! Claro, con gusto te ayudo. ¿Qué tipo de servicio te interesa específicamente?',
        fromMe: true,
        timestamp: (Date.now() - 540000) / 1000, // 9 minutes ago
        hasMedia: false,
        type: 'text',
        chatId: chatId,
        author: null,
        authorProfilePic: null,
        authorNumber: null
      },
      {
        id: `msg_${chatId}_3`,
        body: 'Estoy interesado en sus planes de gestión de clientes. ¿Tienen algo disponible?',
        fromMe: false,
        timestamp: (Date.now() - 300000) / 1000, // 5 minutes ago
        hasMedia: false,
        type: 'text',
        chatId: chatId,
        author: null,
        authorProfilePic: null,
        authorNumber: '+1234567890'
      },
      {
        id: `msg_${chatId}_4`,
        body: 'Perfecto. Tenemos varios planes disponibles. Te puedo mostrar nuestras opciones y precios.',
        fromMe: true,
        timestamp: (Date.now() - 240000) / 1000, // 4 minutes ago
        hasMedia: false,
        type: 'text',
        chatId: chatId,
        author: null,
        authorProfilePic: null,
        authorNumber: null
      }
    ];

    console.log(`💬 Enviando ${demoMessages.length} mensajes demo para chat ${chatId}`);

    res.json({
      success: true,
      messages: demoMessages
    });

  } catch (error) {
    console.error('❌ Error obteniendo mensajes demo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Send message in demo mode
 */
router.post('/whatsapp-accounts/:accountId/send-message', async (req: any, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { chatId, message } = req.body;

    // Verify access to this account
    if (!req.user?.allowedAccountIds?.includes(accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado a esta cuenta'
      });
    }

    // Simulate message sending in demo mode
    console.log(`📤 Simulando envío de mensaje demo: "${message}" a chat ${chatId}`);

    // Generate a response ID
    const messageId = `demo_sent_${Date.now()}`;

    // Simulate successful send
    setTimeout(() => {
      console.log(`✅ Mensaje demo enviado exitosamente: ${messageId}`);
    }, 1000);

    res.json({
      success: true,
      messageId: messageId,
      message: 'Mensaje enviado exitosamente (modo demo)',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Error enviando mensaje demo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Get demo user statistics
 */
router.get('/demo/stats', async (req: any, res) => {
  try {
    if (req.user?.role !== 'demo') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const stats = await getDemoUserStats(req.user.id);

    // Get demo user info
    const [demoInfo] = await db.select()
      .from(demoUsers)
      .where(eq(demoUsers.username, req.user.username))
      .limit(1);

    res.json({
      success: true,
      stats: {
        ...stats,
        username: req.user.username,
        customerName: demoInfo?.customerName || 'Usuario Demo',
        expiresAt: demoInfo?.expiresAt,
        daysRemaining: demoInfo?.expiresAt ? Math.ceil((demoInfo.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0,
        status: demoInfo?.status || 'unknown'
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas demo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Get demo account configuration
 */
router.get('/whatsapp-accounts/:accountId/config', async (req: any, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    // Verify access to this account
    if (!req.user?.allowedAccountIds?.includes(accountId)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado a esta cuenta'
      });
    }

    const [account] = await db.select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId))
      .limit(1);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    res.json({
      success: true,
      config: {
        autoResponseEnabled: account.autoResponseEnabled,
        responseDelay: account.responseDelay,
        customPrompt: account.customPrompt,
        targetLanguage: account.targetLanguage,
        translateToSpanish: account.translateToSpanish,
        assignedExternalAgentId: account.assignedExternalAgentId
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo configuración demo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;