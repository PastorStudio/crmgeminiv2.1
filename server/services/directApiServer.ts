/**
 * Implementación de rutas de API directas que no pasan por Vite
 */

import type { Express, Request, Response } from "express";
import whatsappService from './simplified-whatsappService';
import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';
import { storage } from '../storage';
import { RealWhatsAppActivator } from './realWhatsAppActivator';

export function registerDirectAPIRoutes(app: Express): void {
  
  // Ruta para usuarios que bypasa completamente Vite
  app.get("/api/direct/users", async (req: Request, res: Response) => {
    try {
      console.log("🔄 Direct API: Obteniendo usuarios...");
      const users = await storage.getAllUsers();
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      console.log(`✅ Direct API: Enviando ${safeUsers.length} usuarios`);
      console.log(`📋 Direct API: Lista:`, safeUsers.map(u => u.username));
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).json(safeUsers);
    } catch (error) {
      console.error("❌ Direct API: Error obteniendo usuarios:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Ruta para asignación de chat que bypasa completamente Vite
  app.post("/api/direct/chat-assignment", async (req: Request, res: Response) => {
    try {
      console.log("🔧 Direct API: Asignación de chat:", req.body);
      
      const { chatId, accountId, assignedToId, category } = req.body;
      
      if (!chatId || !accountId) {
        return res.status(400).json({ error: 'Se requiere chatId y accountId' });
      }

      const { db } = await import('../db');
      const { chatAssignments, users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      if (assignedToId === null || assignedToId === undefined) {
        // Desasignar agente
        await db.delete(chatAssignments).where(eq(chatAssignments.chatId, chatId));
        console.log('✅ Direct API: Agente desasignado exitosamente');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.json(null);
      }

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
      
      console.log('✅ Direct API: Asignación creada exitosamente:', response);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ Direct API: Error en asignación:', error);
      res.status(500).json({ error: 'Error al crear asignación: ' + (error as any).message });
    }
  });
  
  // Rutas directas para obtener el estado de WhatsApp (incluido el código QR)
  app.get('/api/direct/whatsapp/status', async (req, res) => {
    try {
      const status = whatsappService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error al obtener estado de WhatsApp:', error);
      res.status(500).json({
        error: 'Error interno',
        message: 'Error al obtener el estado de WhatsApp'
      });
    }
  });

  // Ruta para obtener específicamente el código QR
  app.get('/api/direct/whatsapp/qr', async (req, res) => {
    try {
      const status = whatsappService.getStatus();
      if (status.qrCode) {
        res.json({ qrCode: status.qrCode });
      } else {
        res.status(404).json({
          error: 'QR no disponible',
          message: 'No hay código QR disponible actualmente'
        });
      }
    } catch (error) {
      console.error('Error al obtener código QR:', error);
      res.status(500).json({
        error: 'Error interno',
        message: 'Error al obtener el código QR'
      });
    }
  });

  // Ruta para forzar conexión real de WhatsApp
  app.post('/api/direct/whatsapp/force-real-auth', async (req, res) => {
    try {
      console.log('🔄 Forzando autenticación real de WhatsApp...');
      
      // Force initialize with real authentication
      await whatsappMultiAccountManager.initializeAccount(1);
      
      // Force QR generation for real connection
      const qrResult = await whatsappMultiAccountManager.forceRefreshQR(1);
      
      // Activate aggressive keep-alive
      whatsappMultiAccountManager.activateKeepAlive(1);
      
      const instance = whatsappMultiAccountManager.getInstance(1);
      const status = instance ? instance.status : { authenticated: false, ready: false };
      
      res.json({ 
        success: true,
        message: 'Sistema configurado para datos reales',
        status,
        qrGenerated: qrResult
      });
    } catch (error) {
      console.error('Error forzando autenticación real:', error);
      res.status(500).json({
        success: false,
        message: 'Error estableciendo conexión real'
      });
    }
  });

  // Ruta para inicializar el servicio de WhatsApp (legacy)
  app.post('/api/direct/whatsapp/initialize', async (req, res) => {
    try {
      await whatsappService.initialize();
      const status = whatsappService.getStatus();
      res.json({ 
        message: 'Servicio inicializado correctamente',
        status
      });
    } catch (error) {
      console.error('Error al inicializar servicio de WhatsApp:', error);
      res.status(500).json({
        error: 'Error interno',
        message: 'Error al inicializar el servicio de WhatsApp'
      });
    }
  });

  // Ruta para mostrar el código QR como imagen
  app.get('/api/direct/whatsapp/qr-image', async (req, res) => {
    try {
      const status = whatsappService.getStatus();
      if (status.qrCode) {
        // Redirige al servicio de API de QR
        res.redirect(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(status.qrCode)}`);
      } else {
        res.status(404).send('No hay código QR disponible actualmente');
      }
    } catch (error) {
      console.error('Error al generar imagen de QR:', error);
      res.status(500).send('Error interno al generar la imagen del código QR');
    }
  });

  // Endpoint para obtener chats
  app.get('/api/direct/whatsapp/chats', async (req, res) => {
    try {
      console.log('🔄 API directa: Obteniendo chats desde WhatsApp...');
      
      // Verificar autenticación real de WhatsApp
      const instance = whatsappMultiAccountManager.getInstance(1);
      if (instance && instance.client && instance.status.authenticated && instance.status.ready) {
        try {
          console.log('🔄 Obteniendo datos auténticos de WhatsApp...');
          const chats = await instance.client.getChats();
          
          if (chats && chats.length > 0) {
            const processedChats = chats.slice(0, 50).map(chat => ({
              id: chat.id._serialized || chat.id,
              name: chat.name || chat.id.user || 'Sin nombre',
              isGroup: Boolean(chat.isGroup),
              timestamp: chat.timestamp || Date.now() / 1000,
              unreadCount: chat.unreadCount || 0,
              lastMessage: chat.lastMessage?.body || '',
              accountId: 1
            }));
            console.log(`✅ DATOS REALES: ${processedChats.length} chats auténticos de WhatsApp`);
            res.json(processedChats);
            return;
          } else {
            console.log('📱 WhatsApp conectado pero sin chats disponibles');
          }
        } catch (error) {
          console.log('❌ Error accediendo a datos reales de WhatsApp:', error);
        }
      }
      
      // Verificar si necesita inicialización o reconexión
      if (instance && !instance.status.authenticated) {
        console.log('🔄 Intentando reconexión automática...');
        try {
          await whatsappMultiAccountManager.initializeAccount(1);
        } catch (error) {
          console.log('❌ Error en reconexión:', error);
        }
      }
      
      // Si no hay instancia, crear una
      if (!instance) {
        console.log('🔄 Inicializando cuenta WhatsApp para datos reales...');
        try {
          await whatsappMultiAccountManager.initializeAccount(1);
        } catch (error) {
          console.log('❌ Error inicializando cuenta:', error);
        }
      }
      
      // Forzar activación del keep-alive para mantener conexión
      if (instance) {
        console.log('🔄 Activando keep-alive para mantener conexión persistente...');
        whatsappMultiAccountManager.activateKeepAlive(1);
      }
      
      // Force real authentication status check
      const authStatus = await RealWhatsAppActivator.checkAuthenticationStatus();
      
      console.log('📱 Estado de autenticación WhatsApp:', authStatus);
      
      if (!authStatus.authenticated) {
        console.log('🔄 Activando sistema de datos reales...');
        await RealWhatsAppActivator.activateRealConnections();
      }
      
      console.log('📱 WhatsApp requiere autenticación - escanear código QR para datos reales');
      res.json([]);
    } catch (error) {
      console.error('❌ Error obteniendo chats:', error);
      res.json([]);
    }
  });

  // Endpoint para obtener mensajes de un chat
  app.get('/api/direct/whatsapp/messages/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      console.log(`🔄 Obteniendo mensajes para chat ${chatId}...`);
      
      const status = whatsappService.getStatus();
      if (status.authenticated && status.ready) {
        const instance = whatsappMultiAccountManager.getInstance(1);
        if (instance && instance.client) {
          try {
            const chat = await instance.client.getChatById(chatId);
            if (chat) {
              const messages = await chat.fetchMessages({ limit });
              const processedMessages = messages.map(msg => ({
                id: msg.id._serialized || msg.id,
                body: msg.body || '',
                fromMe: Boolean(msg.fromMe),
                timestamp: msg.timestamp || Date.now() / 1000,
                hasMedia: Boolean(msg.hasMedia),
                type: msg.type || 'chat',
                author: msg.author || null
              }));
              console.log(`✅ Obtenidos ${processedMessages.length} mensajes para chat ${chatId}`);
              res.json(processedMessages);
              return;
            }
          } catch (error) {
            console.log('❌ Error obteniendo mensajes:', error);
          }
        }
      }
      
      console.log('📭 No se pudieron obtener mensajes');
      res.json([]);
    } catch (error) {
      console.error(`❌ Error obteniendo mensajes para chat ${chatId}:`, error);
      res.json([]);
    }
  });

  // Endpoint para enviar mensajes
  app.post('/api/direct/whatsapp/send-message', async (req, res) => {
    try {
      const { chatId, message, accountId } = req.body;
      
      console.log(`📤 Enviando mensaje a chat ${chatId}...`);
      
      // Usar accountId especificado o por defecto la cuenta 1
      const targetAccountId = accountId || 1;
      
      const result = await whatsappMultiAccountManager.sendMessage(targetAccountId, chatId, message);
      
      console.log(`✅ Mensaje enviado exitosamente`);
      res.json({ success: true, result });
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      res.status(500).json({ error: 'Error al enviar mensaje' });
    }
  });

  // Endpoint directo para fotos de perfil de WhatsApp
  app.get('/api/direct/whatsapp-accounts/:accountId/contact/:contactId/profile-picture', async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const contactId = req.params.contactId;
      
      console.log(`📸 API Directa: Solicitando foto de perfil para contacto ${contactId} en cuenta ${accountId}`);
      
      // Obtener la foto de perfil desde WhatsApp
      const profilePicUrl = await whatsappMultiAccountManager.getContactProfilePicture(accountId, contactId);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      if (profilePicUrl) {
        console.log(`✅ API Directa: Foto de perfil obtenida para ${contactId}`);
        res.json({
          success: true,
          contactId: contactId,
          profilePicUrl: profilePicUrl
        });
      } else {
        console.log(`📸 API Directa: No se encontró foto de perfil para ${contactId}`);
        res.json({
          success: false,
          contactId: contactId,
          profilePicUrl: null,
          message: 'No se pudo obtener la foto de perfil'
        });
      }
    } catch (error) {
      console.error('❌ API Directa: Error obteniendo foto de perfil:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno obteniendo foto de perfil',
        details: (error as Error).message
      });
    }
  });

  // Manual demo creation endpoint
  app.post("/api/direct/demo/create-manual", async (req: Request, res: Response) => {
    // Add CORS headers for direct API calls
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
      console.log(`🎭 [DEMO CREATION] Request received:`, req.body);
      const { customerName, phoneNumber } = req.body;

      console.log(`🎭 Creating manual demo for customer: ${customerName}, phone: ${phoneNumber}`);

      if (!customerName || !phoneNumber) {
        console.log(`❌ [DEMO CREATION] Missing required fields: customerName=${customerName}, phoneNumber=${phoneNumber}`);
        return res.status(400).json({
          success: false,
          message: "Nombre del cliente y número de teléfono son requeridos"
        });
      }

      // Import necessary modules
      const { db } = await import('../db');
      const { demoUsers } = await import('@shared/schema');

      // Generate unique username and password
      const timestamp = Date.now();
      const username = `demo_${customerName.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
      const password = `demo123456`; // Standard demo password

      // Set expiration to 3 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);

      // Create demo user in database
      const [demoUser] = await db.insert(demoUsers).values({
        customerName,
        phoneNumber,
        username,
        password,
        chatId: null,
        requestedAt: new Date(),
        expiresAt,
        status: 'active',
        createdBy: 'manual_admin',
        notes: 'Demo creado manualmente por administrador',
        lastLoginAt: null,
        loginCount: 0
      }).returning();

      console.log(`✅ Manual demo created successfully: ${username}`);

      res.json({
        success: true,
        message: "Demo creado exitosamente",
        demo: {
          id: demoUser.id,
          customerName: demoUser.customerName,
          phoneNumber: demoUser.phoneNumber,
          username: demoUser.username,
          password: demoUser.password,
          expiresAt: demoUser.expiresAt,
          status: demoUser.status
        }
      });
    } catch (error) {
      console.error("❌ [DEMO CREATION] Error creating manual demo:", error);
      console.error("❌ [DEMO CREATION] Stack trace:", (error as Error).stack);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor al crear demo",
        error: (error as Error).message
      });
    }
  });

  // Demo list endpoint
  app.get("/api/direct/demo/list", async (req: Request, res: Response) => {
    try {
      console.log("📋 Fetching demo users list...");
      
      const { db } = await import('../db');
      const { demoUsers } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');

      const demos = await db.select().from(demoUsers).orderBy(desc(demoUsers.requestedAt));
      
      const enrichedDemos = demos.map(demo => {
        const now = new Date();
        const expirationDate = new Date(demo.expiresAt);
        const timeDiff = expirationDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
        const isExpired = now > expirationDate;

        return {
          ...demo,
          daysRemaining,
          isExpired,
          loginCount: demo.loginCount || 0
        };
      });

      console.log(`✅ Returning ${enrichedDemos.length} demo users`);

      res.json({
        success: true,
        demos: enrichedDemos
      });
    } catch (error) {
      console.error('❌ Error fetching demos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cargar demos'
      });
    }
  });

  // Demo login endpoint that properly bypasses Vite
  app.post("/api/direct/demo/login-auth", async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
      const { username, password } = req.body;

      console.log(`🎭 Demo login attempt: ${username}`);

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Usuario y contraseña requeridos"
        });
      }

      const { db } = await import('../db');
      const { demoUsers } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const bcrypt = await import('bcrypt');

      // Find demo user
      const [demoUser] = await db.select()
        .from(demoUsers)
        .where(eq(demoUsers.username, username));

      if (!demoUser) {
        return res.status(401).json({
          success: false,
          message: "Credenciales inválidas"
        });
      }

      // Check password using bcrypt since passwords are hashed
      const isPasswordValid = await bcrypt.compare(password, demoUser.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Credenciales inválidas"
        });
      }

      // Check if expired
      if (new Date() > new Date(demoUser.expiresAt)) {
        return res.status(401).json({
          success: false,
          message: "Demo expirado"
        });
      }

      // Update login stats
      await db.update(demoUsers)
        .set({
          lastLoginAt: new Date(),
          loginCount: demoUser.loginCount + 1,
          updatedAt: new Date()
        })
        .where(eq(demoUsers.id, demoUser.id));

      // Generate demo token
      const token = `demo-token-${demoUser.id}-${Date.now()}`;

      console.log(`✅ Demo login successful: ${username}`);

      res.json({
        success: true,
        token,
        user: {
          id: demoUser.id,
          username: demoUser.username,
          customerName: demoUser.customerName,
          role: 'demo',
          expiresAt: demoUser.expiresAt
        }
      });
    } catch (error) {
      console.error("Error in demo login:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  });

  // Demo creation endpoint with sequential numbering
  app.post("/api/direct/demo/create", async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
      const { customerName } = req.body;

      if (!customerName) {
        return res.status(400).json({
          success: false,
          message: "Nombre del cliente requerido"
        });
      }

      const { db } = await import('../db');
      const { demoUsers } = await import('@shared/schema');
      const { max } = await import('drizzle-orm');
      const bcrypt = await import('bcrypt');

      // Get next sequential demo number
      const result = await db
        .select({ maxNumber: max(demoUsers.demoNumber) })
        .from(demoUsers);
      
      const nextNumber = (result[0]?.maxNumber || 0) + 1;
      
      if (nextNumber > 1000) {
        return res.status(400).json({
          success: false,
          message: "Límite de demos alcanzado (máximo 1000)"
        });
      }

      // Format demo number with leading zeros
      const formattedNumber = nextNumber.toString().padStart(5, '0');
      
      // Clean customer name for username
      const cleanName = customerName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      const username = `demo_${cleanName}_${formattedNumber}`;
      const password = 'demo123456';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3); // 3 days from now

      // Create demo user
      const [demoUser] = await db
        .insert(demoUsers)
        .values({
          customerName,
          phoneNumber: '',
          username,
          password: hashedPassword,
          demoNumber: nextNumber,
          expiresAt,
          status: 'active',
          loginCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Also create in users table for compatibility
      const { users } = await import('@shared/schema');
      await db
        .insert(users)
        .values({
          username,
          email: `${username}@demo.local`,
          password: hashedPassword,
          firstName: customerName.split(' ')[0] || customerName,
          lastName: customerName.split(' ').slice(1).join(' ') || '',
          role: 'demo',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

      console.log(`✅ Created demo user: ${username} (Demo #${formattedNumber})`);

      res.json({
        success: true,
        demoUser: {
          id: demoUser.id,
          username,
          customerName,
          demoNumber: nextNumber,
          password, // Return plain password for immediate use
          expiresAt: demoUser.expiresAt
        }
      });
    } catch (error) {
      console.error("Error creating demo user:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  });

  console.log('Rutas de API directa registradas correctamente');
}