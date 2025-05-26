import { Client, LocalAuth, Message, Chat, Contact } from 'whatsapp-web.js';
import { db } from '../db';
import { whatsappAccounts, externalAgents, agentResponses } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import { externalAgentService } from './externalAgentService';

interface WhatsAppClient {
  id: number;
  name: string;
  client: Client;
  status: 'connecting' | 'authenticated' | 'ready' | 'disconnected' | 'pending_auth';
  qrCode?: string;
  lastActivity: Date;
  assignedExternalAgentId?: string | null;
  autoResponseEnabled?: boolean;
}

export class WhatsAppMultiAccountManager {
  private clients: Map<number, WhatsAppClient> = new Map();
  private sessionPath: string;
  private processedMessages = new Set<string>();

  constructor() {
    this.sessionPath = path.join(process.cwd(), 'temp', 'whatsapp-accounts');
    this.ensureSessionDirectory();
    console.log('🚀 WhatsApp Multi-Account Manager inicializado');
  }

  private ensureSessionDirectory(): void {
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  async initializeAllAccounts(): Promise<void> {
    try {
      console.log('🔄 Inicializando todas las cuentas de WhatsApp...');

      const accounts = await db.select().from(whatsappAccounts);
      console.log(`📱 Encontradas ${accounts.length} cuentas para inicializar`);

      for (const account of accounts) {
        await this.initializeAccount(account.id, account.name);
      }
    } catch (error) {
      console.error('❌ Error al inicializar cuentas:', error);
    }
  }

  async initializeAccount(accountId: number, accountName: string): Promise<void> {
    try {
      if (this.clients.has(accountId)) {
        console.log(`⚠️ Cuenta ${accountId} ya está inicializada`);
        return;
      }

      console.log(`🔄 Inicializando cuenta ${accountId}: ${accountName}`);

      const sessionDir = path.join(this.sessionPath, `account_${accountId}`);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `account_${accountId}`,
          dataPath: sessionDir
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        }
      });

      const whatsappClient: WhatsAppClient = {
        id: accountId,
        name: accountName,
        client,
        status: 'connecting',
        lastActivity: new Date()
      };

      this.clients.set(accountId, whatsappClient);

      // Configurar event listeners
      this.setupEventListeners(whatsappClient);

      // Inicializar cliente
      await client.initialize();

    } catch (error) {
      console.error(`❌ Error al inicializar cuenta ${accountId}:`, error);
    }
  }

  private setupEventListeners(whatsappClient: WhatsAppClient): void {
    const { client, id } = whatsappClient;

    client.on('qr', (qr) => {
      console.log(`📱 Código QR generado para cuenta ${id}`);
      whatsappClient.qrCode = qr;
      whatsappClient.status = 'pending_auth';
      this.saveQRCode(id, qr);
    });

    client.on('authenticated', () => {
      console.log(`✅ Cuenta ${id} autenticada`);
      whatsappClient.status = 'authenticated';
    });

    client.on('ready', async () => {
      console.log(`🚀 Cuenta ${id} lista para usar`);
      whatsappClient.status = 'ready';
      whatsappClient.lastActivity = new Date();

      // Obtener configuración de la cuenta
      const [account] = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.id, id));
      if (account) {
        whatsappClient.assignedExternalAgentId = account.assignedExternalAgentId;
        whatsappClient.autoResponseEnabled = account.autoResponseEnabled;
        console.log(`⚙️ Cuenta ${id} configurada - AI: ${account.autoResponseEnabled ? 'ACTIVADO' : 'DESACTIVADO'}, Agente: ${account.assignedExternalAgentId || 'NINGUNO'}`);
      }
    });

    client.on('message', async (message) => {
      await this.handleIncomingMessage(whatsappClient, message);
    });

    client.on('disconnected', (reason) => {
      console.log(`❌ Cuenta ${id} desconectada:`, reason);
      whatsappClient.status = 'disconnected';
    });

    client.on('auth_failure', (msg) => {
      console.log(`❌ Fallo de autenticación en cuenta ${id}:`, msg);
      whatsappClient.status = 'pending_auth';
    });
  }

  private async handleIncomingMessage(whatsappClient: WhatsAppClient, message: Message): Promise<void> {
    try {
      // No procesar mensajes propios
      if (message.fromMe) {
        return;
      }

      // Evitar procesamiento duplicado
      const messageKey = `${whatsappClient.id}_${message.id._serialized}`;
      if (this.processedMessages.has(messageKey)) {
        return;
      }
      this.processedMessages.add(messageKey);

      console.log(`📨 MENSAJE RECIBIDO en cuenta ${whatsappClient.id}: "${message.body?.substring(0, 50)}..."`);

      // Verificar si las respuestas automáticas están habilitadas
      if (!whatsappClient.autoResponseEnabled) {
        console.log(`⚠️ Respuestas automáticas deshabilitadas para cuenta ${whatsappClient.id}`);
        return;
      }

      // Verificar si hay agente externo asignado
      if (!whatsappClient.assignedExternalAgentId) {
        console.log(`⚠️ No hay agente externo asignado para cuenta ${whatsappClient.id}`);
        return;
      }

      // Obtener información del contacto
      const contact = await message.getContact();
      const contactName = contact.name || contact.pushname || contact.number;
      const chatId = message.from;

      console.log(`🤖 Procesando mensaje con agente externo ${whatsappClient.assignedExternalAgentId}`);

      // Generar respuesta con agente externo
      const response = await externalAgentService.sendMessageToAgent(
        whatsappClient.assignedExternalAgentId,
        message.body || '',
        chatId
      );

      if (response && response.trim() !== '') {
        console.log(`✅ Respuesta generada: "${response.substring(0, 100)}..."`);

        // Enviar respuesta
        await this.sendMessage(whatsappClient.id, chatId, response);
        console.log(`📤 Respuesta automática enviada a ${contactName}`);
      } else {
        console.log(`❌ No se pudo generar respuesta para cuenta ${whatsappClient.id}`);
      }

    } catch (error) {
      console.error(`❌ Error procesando mensaje en cuenta ${whatsappClient.id}:`, error);
    }
  }

  async sendMessage(accountId: number, chatId: string, message: string): Promise<boolean> {
    try {
      const whatsappClient = this.clients.get(accountId);

      if (!whatsappClient || whatsappClient.status !== 'ready') {
        console.log(`❌ Cuenta ${accountId} no está lista para enviar mensajes`);
        return false;
      }

      const chat = await whatsappClient.client.getChatById(chatId);
      await chat.sendMessage(message);

      console.log(`✅ Mensaje enviado desde cuenta ${accountId} a ${chatId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error enviando mensaje desde cuenta ${accountId}:`, error);
      return false;
    }
  }

  async getAccountChats(accountId: number): Promise<any[]> {
    try {
      const whatsappClient = this.clients.get(accountId);

      if (!whatsappClient || whatsappClient.status !== 'ready') {
        console.log(`⚠️ Cuenta ${accountId} no está activa (estado: ${whatsappClient?.status || 'no encontrada'})`);
        return [];
      }

      const chats = await whatsappClient.client.getChats();
      return chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name || 'Sin nombre',
        isGroup: chat.isGroup,
        unreadCount: chat.unreadCount,
        lastMessage: chat.lastMessage ? {
          body: chat.lastMessage.body,
          timestamp: chat.lastMessage.timestamp,
          fromMe: chat.lastMessage.fromMe
        } : null
      }));
    } catch (error) {
      console.error(`❌ Error obteniendo chats de cuenta ${accountId}:`, error);
      return [];
    }
  }

  async getChatMessages(accountId: number, chatId: string, limit: number = 50): Promise<any[]> {
    try {
      const whatsappClient = this.clients.get(accountId);

      if (!whatsappClient || whatsappClient.status !== 'ready') {
        return [];
      }

      const chat = await whatsappClient.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });

      return messages.map(msg => ({
        id: msg.id._serialized,
        body: msg.body,
        fromMe: msg.fromMe,
        timestamp: msg.timestamp,
        type: msg.type,
        hasMedia: msg.hasMedia
      }));
    } catch (error) {
      console.error(`❌ Error obteniendo mensajes de chat ${chatId} en cuenta ${accountId}:`, error);
      return [];
    }
  }

  getAccountStatus(accountId: number): any {
    const whatsappClient = this.clients.get(accountId);

    if (!whatsappClient) {
      return {
        status: 'not_initialized',
        qrCode: null,
        lastActivity: null
      };
    }

    return {
      status: whatsappClient.status,
      qrCode: whatsappClient.qrCode,
      lastActivity: whatsappClient.lastActivity,
      autoResponseEnabled: whatsappClient.autoResponseEnabled,
      assignedExternalAgentId: whatsappClient.assignedExternalAgentId
    };
  }

  getAllAccountsStatus(): any[] {
    const accounts = [];

    for (const [accountId, whatsappClient] of this.clients.entries()) {
      accounts.push({
        id: accountId,
        name: whatsappClient.name,
        status: whatsappClient.status,
        qrCode: whatsappClient.qrCode,
        lastActivity: whatsappClient.lastActivity,
        autoResponseEnabled: whatsappClient.autoResponseEnabled,
        assignedExternalAgentId: whatsappClient.assignedExternalAgentId
      });
    }

    return accounts;
  }

  async updateAccountConfig(accountId: number): Promise<void> {
    try {
      const whatsappClient = this.clients.get(accountId);
      if (!whatsappClient) {
        return;
      }

      // Recargar configuración desde la base de datos
      const [account] = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.id, accountId));
      if (account) {
        whatsappClient.assignedExternalAgentId = account.assignedExternalAgentId;
        whatsappClient.autoResponseEnabled = account.autoResponseEnabled;
        console.log(`⚙️ Configuración actualizada para cuenta ${accountId} - AI: ${account.autoResponseEnabled ? 'ACTIVADO' : 'DESACTIVADO'}, Agente: ${account.assignedExternalAgentId || 'NINGUNO'}`);
      }
    } catch (error) {
      console.error(`❌ Error actualizando configuración de cuenta ${accountId}:`, error);
    }
  }

  private saveQRCode(accountId: number, qrCode: string): void {
    try {
      const qrPath = path.join(this.sessionPath, `account_${accountId}`, 'qr.txt');
      fs.writeFileSync(qrPath, qrCode);
    } catch (error) {
      console.error(`❌ Error guardando QR para cuenta ${accountId}:`, error);
    }
  }

  async disconnectAccount(accountId: number): Promise<void> {
    try {
      const whatsappClient = this.clients.get(accountId);

      if (whatsappClient) {
        await whatsappClient.client.destroy();
        this.clients.delete(accountId);
        console.log(`✅ Cuenta ${accountId} desconectada`);
      }
    } catch (error) {
      console.error(`❌ Error desconectando cuenta ${accountId}:`, error);
    }
  }
}

// Instancia singleton
export const whatsappMultiAccountManager = new WhatsAppMultiAccountManager();