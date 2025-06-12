/**
 * Sistema completamente independiente de respuestas automáticas
 * Funciona sin ninguna dependencia del frontend
 */

import { db } from '../db';
import { whatsappAccounts, whatsappMessages, externalAgents } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import { chatgptPlusDirectService } from './chatgptPlusDirectService';
import { realtimeDemoCreator } from './realtimeDemoCreator';

interface IndependentConfig {
  accountId: number;
  enabled: boolean;
  agentName: string;
  lastProcessed: Date;
}

class IndependentAutoResponseService {
  private configs = new Map<number, IndependentConfig>();
  private processingInterval?: NodeJS.Timeout;
  private isRunning = false;
  private openai: OpenAI;

  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Inicializa el servicio completamente independiente
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 Sistema independiente ya está funcionando');
      return;
    }

    console.log('🚀 Iniciando sistema de respuestas automáticas INDEPENDIENTE...');
    
    try {
      // Cargar configuraciones desde la base de datos
      await this.loadConfigurations();
      
      // Iniciar procesamiento continuo
      this.startContinuousProcessing();
      
      this.isRunning = true;
      console.log('✅ Sistema independiente iniciado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando sistema independiente:', error);
      throw error;
    }
  }

  /**
   * Carga configuraciones desde la base de datos
   */
  private async loadConfigurations(): Promise<void> {
    try {
      console.log('🔄 Cargando configuraciones de respuestas automáticas...');
      
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      for (const account of accounts) {
        this.configs.set(account.id, {
          accountId: account.id,
          enabled: true,
          agentName: account.assignedExternalAgentId ? 'AI Assistant' : 'Smart Bot',
          lastProcessed: new Date()
        });
      }

      console.log(`📊 Configuraciones cargadas para ${this.configs.size} cuentas`);
    } catch (error) {
      console.error('❌ Error cargando configuraciones:', error);
    }
  }

  /**
   * Inicia procesamiento continuo cada 10 segundos
   */
  private startContinuousProcessing(): void {
    console.log('⏰ Iniciando procesamiento continuo cada 10 segundos...');
    
    this.processingInterval = setInterval(async () => {
      await this.processNewMessages();
    }, 10000); // Cada 10 segundos
  }

  /**
   * Procesa mensajes nuevos de forma independiente
   */
  private async processNewMessages(): Promise<void> {
    if (this.configs.size === 0) {
      return;
    }

    try {
      for (const [accountId, config] of this.configs) {
        if (!config.enabled) continue;

        // Buscar mensajes nuevos desde la última vez procesada
        const newMessages = await db
          .select()
          .from(whatsappMessages)
          .where(
            and(
              eq(whatsappMessages.accountId, accountId),
              eq(whatsappMessages.from_me, false)
            )
          )
          .orderBy(desc(whatsappMessages.timestamp))
          .limit(5);

        for (const message of newMessages) {
          await this.processMessage(accountId, message);
        }

        // Actualizar última vez procesada
        config.lastProcessed = new Date();
      }
    } catch (error) {
      console.error('❌ Error procesando mensajes nuevos:', error);
    }
  }

  /**
   * Procesa un mensaje individual
   */
  private async processMessage(accountId: number, message: any): Promise<void> {
    try {
      const config = this.configs.get(accountId);
      if (!config) return;

      console.log(`🤖 Procesando mensaje independiente - Cuenta: ${accountId}, Chat: ${message.chatId}`);

      // NOTA: La detección de demo se maneja en unifiedMessageProcessor.ts con enhancedDemoDetector
      // No procesamos demos aquí para evitar duplicación

      // Generar respuesta normal de IA
      const response = await this.generateAIResponse(message.content, config.agentName);
      
      if (response) {
        // Simular envío de respuesta (aquí se conectaría con WhatsApp real)
        console.log(`📤 Respuesta generada para ${message.chatId}: "${response.substring(0, 50)}..."`);
        
        // Guardar la respuesta en la base de datos
        await this.saveResponse(accountId, message.chatId, response);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje individual:', error);
    }
  }

  /**
   * Maneja la creación automática de usuarios demo cuando se detecta el mensaje específico
   */
  private async handleDemoCreation(response: string, chatId: string, accountId: number): Promise<void> {
    try {
      // Detectar si la respuesta contiene palabras clave relacionadas con demo
      const demoKeywords = [
        "demo",
        "prueba",
        "gratis", 
        "credenciales",
        "usuario",
        "contraseña",
        "acceso"
      ];

      // Contar cuántas palabras clave de demo contiene la respuesta
      const keywordMatches = demoKeywords.filter(keyword => 
        response.toLowerCase().includes(keyword.toLowerCase())
      );

      // Si contiene al menos 3 palabras clave relacionadas con demo, activar creación
      const containsDemoMessage = keywordMatches.length >= 3;
      
      if (containsDemoMessage) {
        console.log(`🔍 Palabras clave detectadas: ${keywordMatches.join(', ')}`);
      }

      if (containsDemoMessage) {
        console.log(`🎯 Detectado mensaje de creación de demo para chat: ${chatId}`);
        
        // Extraer nombre del cliente del chatId o usar datos del contacto
        const clientName = await this.extractClientName(chatId);
        const demoUser = await this.createDemoUser(clientName, chatId);
        
        if (demoUser) {
          // Enviar mensaje de seguimiento con credenciales reales
          const credentialsMessage = this.buildCredentialsMessage(demoUser, clientName);
          
          // Enviar el mensaje con las credenciales
          console.log(`📧 Enviando credenciales de demo a ${chatId}: ${credentialsMessage.substring(0, 100)}...`);
          
          // Guardar el mensaje de credenciales
          await this.saveResponse(accountId, chatId, credentialsMessage);
          
          console.log(`✅ Usuario demo creado exitosamente: ${demoUser.username}`);
        }
      }
    } catch (error) {
      console.error('❌ Error manejando creación de demo:', error);
    }
  }

  /**
   * Extrae el nombre del cliente desde el contacto o genera uno
   */
  private async extractClientName(chatId: string): Promise<string> {
    try {
      // Usar la conexión directa a la base de datos
      const { db } = await import('../db');
      const { contacts } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // Buscar en la tabla de contactos
      const contact = await db.select().from(contacts)
        .where(eq(contacts.phone, chatId.replace('@c.us', '')))
        .limit(1);

      if (contact.length > 0 && contact[0].name) {
        return contact[0].name;
      }

      // Si no hay nombre guardado, generar uno basado en el número
      const phoneNumber = chatId.replace('@c.us', '').replace('@g.us', '');
      return `Cliente_${phoneNumber.slice(-4)}`;
    } catch (error) {
      console.error('Error extrayendo nombre del cliente:', error);
      const phoneNumber = chatId.replace('@c.us', '').replace('@g.us', '');
      return `Cliente_${phoneNumber.slice(-4)}`;
    }
  }

  /**
   * Crea un usuario demo en la base de datos
   */
  private async createDemoUser(clientName: string, chatId: string): Promise<any> {
    try {
      const { db } = await import('../db');
      const { demoUsers, users, demoTracking } = await import('@shared/schema');
      const { max } = await import('drizzle-orm');
      const bcrypt = await import('bcrypt');
      
      // Generar credenciales únicas
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000);
      const username = `demo_${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomSuffix}`;
      const password = 'demo123'; // Contraseña estándar para demos
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Calcular fecha de expiración (3 días)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 3);
      
      // Obtener el siguiente número de demo disponible
      const demoNumberResult = await db.select({ 
        nextDemoNumber: max(demoUsers.demoNumber) 
      }).from(demoUsers);
      const demoNumber = (demoNumberResult[0]?.nextDemoNumber || 0) + 1;
      
      // Crear el usuario demo en la tabla demo_users
      const demoUserResult = await db.insert(demoUsers).values({
        customerName: clientName,
        phoneNumber: chatId.replace('@c.us', '').replace('@g.us', ''),
        username: username,
        password: password, // Contraseña sin hash en demo_users para referencia
        demoNumber: demoNumber,
        chatId: chatId,
        expiresAt: expirationDate
      }).returning();

      if (demoUserResult.length > 0) {
        const demoUser = demoUserResult[0];
        
        // También crear un usuario regular para el sistema con permisos demo
        const userResult = await db.insert(users).values({
          username: username,
          fullName: clientName,
          email: `${username}@demo.geminicrm.com`,
          password: hashedPassword, // Hash con bcrypt para seguridad
          role: 'demo',
          status: 'active',
          department: 'demo'
        }).returning();

        const user = userResult[0];
        
        // Registrar en demo_tracking la asociación
        await db.insert(demoTracking).values({
          userId: user.id,
          demoUserId: demoUser.id,
          chatId: chatId,
          phoneNumber: chatId.replace('@c.us', '').replace('@g.us', ''),
          clientName: clientName,
          expiresAt: expirationDate
        });

        return {
          id: user.id,
          username: username,
          fullName: clientName,
          demo_expiration: expirationDate,
          demo_number: demoNumber,
          password: password // Solo para el mensaje de credenciales
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error creando usuario demo:', error);
      return null;
    }
  }

  /**
   * Construye el mensaje con las credenciales del demo
   */
  private buildCredentialsMessage(demoUser: any, clientName: string): string {
    const expirationDate = new Date(demoUser.demo_expiration);
    const formattedDate = expirationDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `🎉 ¡Perfecto ${clientName}! Tu demo personalizado está listo

🔑 **TUS CREDENCIALES DE ACCESO:**
📧 Usuario: ${demoUser.username}
🔒 Contraseña: demo123
🌐 URL: https://geminicrm.com/login

⏰ **DETALLES DE TU ACCESO:**
✅ Duración: 3 días completos
📅 Expira: ${formattedDate}
🚀 Acceso total a todas las funciones premium

🎯 **LO QUE PUEDES HACER:**
• Configurar respuestas automáticas con IA
• Gestionar múltiples cuentas de WhatsApp
• Envío masivo de mensajes
• Análisis avanzados y reportes
• Panel de administración completo

💡 **EMPEZAR AHORA:**
1. Ve a la URL de arriba
2. Ingresa tu usuario y contraseña
3. ¡Explora todas las funciones!

¿Alguna pregunta sobre tu demo? ¡Estoy aquí para ayudarte! 🚀`;
  }

  /**
   * Genera respuesta usando el proveedor de IA configurado
   */
  private async generateAIResponse(messageText: string, agentName: string): Promise<string | null> {
    try {
      console.log(`🤖 Generando respuesta con proveedor de IA para agente: ${agentName}`);
      
      // Import AI provider service
      const { aiProviderService } = await import('./aiProviderService');
      
      // Generate response using configured provider
      const response = await aiProviderService.generateResponse(messageText, agentName);
      
      if (response && response.trim().length > 0) {
        console.log(`✅ Respuesta generada exitosamente: ${response.substring(0, 50)}...`);
        return response;
      }
      
      console.log('⚠️ No se generó respuesta, usando respuesta por defecto');
      return 'Gracias por tu mensaje. Te responderemos pronto.';
      
    } catch (error) {
      console.error('❌ Error generando respuesta con IA:', error);
      
      // Check if error is related to billing/quota
      if (error.message && (error.message.includes('quota') || error.message.includes('billing'))) {
        console.log('💳 Error de cuota/facturación detectado');
      }
      
      // Fallback to simple response instead of failing
      const fallbackResponses = [
        'Gracias por contactarnos. Tu mensaje es importante para nosotros.',
        'Hemos recibido tu mensaje y te responderemos pronto.',
        'Estamos aquí para ayudarte. Un representante se pondrá en contacto contigo.',
        'Tu consulta ha sido recibida. Te responderemos en breve.',
        'Apreciamos tu contacto. Te responderemos lo antes posible.',
        'Hemos recibido tu mensaje y te atenderemos a la brevedad.',
        'Tu consulta es importante para nosotros. Te atenderemos pronto.',
        'Gracias por contactarnos. Un representante se pondrá en contacto contigo.'
      ];
      
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      console.log(`🔄 Usando respuesta de respaldo: ${randomResponse}`);
      return randomResponse;
    }
  }

  /**
   * Guarda la respuesta en la base de datos
   */
  private async saveResponse(accountId: number, chatId: string, response: string): Promise<void> {
    try {
      await db.insert(whatsappMessages).values({
        accountId,
        chatId,
        messageId: `auto_${Date.now()}`,
        content: response,
        from_me: true,
        timestamp: new Date(),
        hasMedia: false
      });
    } catch (error) {
      console.error('❌ Error guardando respuesta:', error);
    }
  }

  /**
   * Habilita respuestas automáticas para una cuenta
   */
  async enableForAccount(accountId: number, agentName: string = 'AI Assistant'): Promise<void> {
    console.log(`🟢 Habilitando respuestas independientes para cuenta ${accountId}`);
    
    this.configs.set(accountId, {
      accountId,
      enabled: true,
      agentName,
      lastProcessed: new Date()
    });

    // Actualizar en base de datos
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: true })
      .where(eq(whatsappAccounts.id, accountId));
  }

  /**
   * Deshabilita respuestas automáticas para una cuenta
   */
  async disableForAccount(accountId: number): Promise<void> {
    console.log(`🔴 Deshabilitando respuestas independientes para cuenta ${accountId}`);
    
    this.configs.delete(accountId);

    // Actualizar en base de datos
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: false })
      .where(eq(whatsappAccounts.id, accountId));
  }

  /**
   * Obtiene estado del sistema
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      activeAccounts: Array.from(this.configs.keys()),
      totalConfigs: this.configs.size,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Detiene el sistema
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    this.isRunning = false;
    console.log('🛑 Sistema independiente detenido');
  }
}

// Exportar instancia única
export const independentAutoResponseService = new IndependentAutoResponseService();