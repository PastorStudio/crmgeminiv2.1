/**
 * Sistema completamente independiente de respuestas automáticas
 * Funciona sin ninguna dependencia del frontend
 */

import { db } from '../db';
import { whatsappAccounts, whatsappMessages, externalAgents } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
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
  private processedMessages = new Set<string>();
  private geminiQuotaExhausted = false;
  private lastQuotaCheck = new Date();

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
   * Inicia procesamiento inteligente con control de cuota
   */
  private startContinuousProcessing(): void {
    console.log('⏰ Iniciando procesamiento inteligente cada 60 segundos...');
    
    this.processingInterval = setInterval(async () => {
      // Verificar si Gemini sigue agotado (se resetea cada 24 horas)
      const hoursAgo = (Date.now() - this.lastQuotaCheck.getTime()) / (1000 * 60 * 60);
      if (this.geminiQuotaExhausted && hoursAgo > 24) {
        this.geminiQuotaExhausted = false;
        console.log('🔄 Cuota de Gemini reseteada después de 24 horas');
      }
      
      await this.processNewMessages();
    }, 60000); // Cada 60 segundos para evitar sobrecarga
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

        // Buscar solo mensajes recientes no procesados
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
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
          .limit(2);

        for (const message of newMessages) {
          const messageKey = `${accountId}-${message.id}`;
          if (!this.processedMessages.has(messageKey)) {
            await this.processMessage(accountId, message);
            this.processedMessages.add(messageKey);
          }
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

      // Verificar si el mensaje solicita una demostración
      const demoResponse = await this.checkForDemoRequest(message.content, message.chatId, accountId);
      if (demoResponse) {
        console.log(`🎭 Creando usuario demo para ${message.chatId}`);
        console.log(`📤 Respuesta de demo para ${message.chatId}: "${demoResponse.substring(0, 50)}..."`);
        await this.saveResponse(accountId, message.chatId, demoResponse);
        return;
      }

      // Generar respuesta normal de IA usando Gemini como proveedor principal
      const response = await this.generateAIResponseWithGemini(message.content, config.agentName);
      
      if (response) {
        console.log(`📤 Respuesta generada para ${message.chatId}: "${response.substring(0, 50)}..."`);
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
   * Verifica si el mensaje solicita una demostración y crea usuario demo automáticamente
   */
  private async checkForDemoRequest(messageText: string, chatId: string, accountId: number): Promise<string | null> {
    try {
      const lowerText = messageText.toLowerCase();
      
      // Palabras clave que indican solicitud de demo
      const demoKeywords = [
        'demo', 'demostración', 'demonstración', 'prueba', 'gratis', 'free',
        'test', 'trial', 'probar', 'acceso', 'usuario', 'contraseña',
        'credenciales', 'login', 'ingresar', 'sistema', 'plataforma'
      ];
      
      // Verificar si el mensaje contiene palabras clave de demo
      const containsDemoKeywords = demoKeywords.some(keyword => lowerText.includes(keyword));
      
      if (containsDemoKeywords) {
        console.log(`🎭 Solicitud de demo detectada en mensaje: ${messageText.substring(0, 50)}...`);
        
        // Extraer nombre del cliente del número de teléfono o usar un nombre por defecto
        const phoneNumber = chatId.replace('@c.us', '');
        const customerName = `Cliente_${phoneNumber.substring(-4)}`;
        
        try {
          // Importar el gestor de usuarios demo
          const { demoUserManager } = await import('./demoUserManager');
          
          // Crear usuario demo
          const demoUser = await demoUserManager.createDemoUser({
            customerName,
            phoneNumber,
            email: `${customerName.toLowerCase()}@demo.local`,
            companyName: '',
            chatId
          });
          
          // Generar respuesta con credenciales
          const demoResponse = `🎉 ¡Tu demo ha sido creado exitosamente!

🔑 **CREDENCIALES DE ACCESO:**
👤 **Usuario:** \`${demoUser.username}\`
🔒 **Contraseña:** \`demo123456\`

🌐 **Acceso al sistema:**
${demoUser.loginUrl}

⏰ **Válido por 3 días** (hasta ${new Date(demoUser.expiresAt).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })})

🚀 **¿Qué puedes hacer?**
• Gestionar contactos y leads
• Enviar mensajes automáticos  
• Ver análisis en tiempo real
• Gestionar múltiples cuentas de WhatsApp
• Usar plantillas de mensajes
• Panel de administración completo

💡 **Para empezar:**
1. Ve a la URL de arriba
2. Ingresa tu usuario y contraseña
3. ¡Explora todas las funciones!

¿Tienes alguna pregunta sobre tu demo? ¡Estoy aquí para ayudarte! 🚀`;
          
          return demoResponse;
          
        } catch (demoError) {
          console.error('❌ Error creando usuario demo:', demoError);
          
          // Verificar si ya existe un demo para este cliente
          if (demoError.message && demoError.message.includes('Ya existe un demo activo')) {
            return `⚠️ Ya tienes un demo activo creado anteriormente. 

Si olvidaste tus credenciales, contacta al administrador para recuperarlas.

¿Necesitas ayuda con algo más? ¡Estoy aquí para ayudarte! 😊`;
          }
          
          return `❌ Disculpa, hubo un problema creando tu demo. 

Un representante se pondrá en contacto contigo para configurar tu acceso manualmente.

¡Gracias por tu interés en nuestro sistema! 🙏`;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error verificando solicitud de demo:', error);
      return null;
    }
  }

  /**
   * Genera respuesta usando Gemini como proveedor principal
   */
  private async generateAIResponseWithGemini(messageText: string, agentName: string): Promise<string | null> {
    try {
      console.log(`🤖 Generando respuesta con Gemini para agente: ${agentName}`);
      
      // Importar servicio de Gemini directamente
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      
      // Obtener clave API de Gemini
      const { pool } = await import('../db');
      const result = await pool.query('SELECT gemini_api_key FROM ai_settings WHERE id = 1');
      
      if (result.rows.length === 0 || !result.rows[0].gemini_api_key) {
        throw new Error('No Gemini API key found');
      }
      
      const apiKey = result.rows[0].gemini_api_key;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Eres ${agentName}, un asistente virtual profesional de atención al cliente en español.

Responde de manera amable, profesional y útil al siguiente mensaje del cliente:

"${messageText}"

Instrucciones:
- Responde en español
- Sé amable y profesional
- Ofrece ayuda adicional
- Mantén la respuesta concisa pero completa
- Si mencionan demo, prueba o acceso, indica que pueden solicitar una demostración`;

      const result_ai = await model.generateContent(prompt);
      const response = await result_ai.response;
      const text = response.text();
      
      if (text && text.trim().length > 0) {
        console.log(`✅ Respuesta generada exitosamente con Gemini: ${text.substring(0, 50)}...`);
        return text.trim();
      }
      
      throw new Error('Empty response from Gemini');
      
    } catch (error) {
      console.error('❌ Error generando respuesta con Gemini:', error);
      
      // Detectar error de cuota agotada
      if (error.message && error.message.includes('429') || error.message.includes('quota')) {
        this.geminiQuotaExhausted = true;
        this.lastQuotaCheck = new Date();
        console.log('🚨 Cuota de Gemini agotada, cambiando a OpenAI...');
        return await this.generateAIResponseWithAlternativeProvider(messageText, agentName);
      }
      
      return this.getFallbackResponse();
    }
  }

  /**
   * Genera respuesta usando proveedor alternativo cuando Gemini falla
   */
  private async generateAIResponseWithAlternativeProvider(messageText: string, agentName: string): Promise<string> {
    try {
      // Intentar con OpenAI primero
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
        console.log('🔄 Usando OpenAI como respaldo...');
        
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Eres ${agentName}, un asistente virtual profesional de atención al cliente en español. Responde de manera amable, profesional y útil.`
            },
            {
              role: 'user',
              content: messageText
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        });

        const response = completion.choices[0]?.message?.content;
        if (response && response.trim().length > 0) {
          console.log('✅ Respuesta generada con OpenAI como respaldo');
          return response.trim();
        }
      }

      // Si OpenAI falla, usar proveedores con DEEPSEEK/QWEN3
      if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'your_deepseek_api_key_here') {
        console.log('🔄 Usando DeepSeek como respaldo...');
        return await this.generateWithDeepSeek(messageText, agentName);
      }

      console.log('⚠️ Todos los proveedores AI fallaron, usando respuesta estática');
      return this.getFallbackResponse();
      
    } catch (error) {
      console.error('❌ Error en proveedor alternativo:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Genera respuesta con DeepSeek
   */
  private async generateWithDeepSeek(messageText: string, agentName: string): Promise<string> {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `Eres ${agentName}, un asistente virtual profesional de atención al cliente en español.`
            },
            {
              role: 'user',
              content: messageText
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || this.getFallbackResponse();
      
    } catch (error) {
      console.error('❌ Error con DeepSeek:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Obtiene una respuesta de fallback cuando la IA falla
   */
  private getFallbackResponse(): string {
    const fallbackResponses = [
      'Gracias por contactarnos. Tu mensaje es importante para nosotros.',
      'Hemos recibido tu mensaje y te responderemos pronto.',
      'Estamos aquí para ayudarte. Un representante se pondrá en contacto contigo.',
      'Tu consulta ha sido recibida. Te responderemos en breve.',
      'Apreciamos tu contacto. Te responderemos lo antes posible.',
      'Hemos recibido tu mensaje y te atenderemos a la brevedad.',
      'Tu consulta es importante para nosotros. Te atenderemos pronto.',
      'Tu mensaje es importante para nosotros. Te contactaremos pronto.',
      'Estamos aquí para ayudarte. Un representante te responderá.'
    ];
    
    const randomIndex = Math.floor(Math.random() * fallbackResponses.length);
    return fallbackResponses[randomIndex];
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