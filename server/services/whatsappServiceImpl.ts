/**
 * Implementación real del servicio de WhatsApp que usa la biblioteca whatsapp-web.js
 * Esta implementación conecta directamente con la API oficial de WhatsApp Web
 */

import * as path from 'path';
import * as fs from 'fs';
import { IWhatsAppService, WhatsAppStatus } from "./whatsappInterface";
import { storage } from "../storage";
import { createBrowser } from './puppeteerConfig';
import { EventEmitter } from 'events';
import child_process from 'child_process';
import util from 'util';

// Importaciones específicas para whatsapp-web.js (deben estar instaladas)
let Client: any;
// Ya no usamos LocalAuth para evitar problemas de compatibilidad
let qrcode: any;

// Instalamos las dependencias necesarias
const exec = util.promisify(child_process.exec);

async function ensureDependencies() {
  try {
    // Intentamos importar whatsapp-web.js
    const wwjs = await import('whatsapp-web.js');
    Client = wwjs.Client;
    // No usamos LocalAuth debido a problemas de compatibilidad
    
    // Intentamos importar qrcode
    qrcode = await import('qrcode');
    
    return true;
  } catch (error) {
    console.error("Error importando dependencias:", error);
    console.log("Instalando dependencias faltantes...");
    
    try {
      await exec('npm install --save whatsapp-web.js qrcode puppeteer puppeteer-extra puppeteer-extra-plugin-stealth');
      
      // Intentamos importar de nuevo
      const wwjs = await import('whatsapp-web.js');
      Client = wwjs.Client;
      // No usamos LocalAuth por compatibilidad
      
      qrcode = await import('qrcode');
      
      console.log("Dependencias instaladas correctamente");
      return true;
    } catch (installError) {
      console.error("Error instalando dependencias:", installError);
      return false;
    }
  }
}

// Directorio temporal para archivos de WhatsApp
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Directorio para sesión de WhatsApp
const SESSION_DIR = path.join(TEMP_DIR, '.wwebjs_auth');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Cliente de WhatsApp con WhatsApp-Web.js
class WhatsAppClient extends EventEmitter {
  private qrCodePath: string;
  private status: WhatsAppStatus;
  private client: any;
  
  constructor() {
    super();
    this.qrCodePath = path.join(TEMP_DIR, 'whatsapp-qr.png');
    this.status = {
      initialized: false,
      ready: false,
      authenticated: false
    };
    this.client = null;
  }
  
  // Inicializar cliente
  async initialize() {
    if (!await ensureDependencies()) {
      throw new Error("No se pudieron instalar las dependencias necesarias para WhatsApp");
    }
    
    try {
      console.log('Iniciando servicio de WhatsApp con Chromium...');
      
      // Obtener navegador configurado
      const browser = await createBrowser();
      
      // Inicializar cliente de WhatsApp-Web.js con una configuración básica
      // sin usar LocalAuth que puede dar problemas en algunos entornos
      this.client = new Client({
        // No usamos authStrategy personalizada
        puppeteer: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
          ],
          headless: true
        }
      });
      
      // Configurar eventos
      this.client.on('qr', async (qr: string) => {
        console.log('Código QR recibido de WhatsApp Web');
        
        // Generar imagen QR y guardarla
        try {
          // Convertir QR a imagen
          const qrDataURL = await qrcode.toDataURL(qr, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 8,
            color: {
              dark: '#122e31',  // Color oscuro del QR
              light: '#ffffff'  // Color claro del QR
            }
          });
          
          // Actualizar estado
          this.status.qrCode = qrDataURL;
          this.emit('qr', qrDataURL);
          
          // Guardar la imagen del QR para depuración
          await qrcode.toFile(this.qrCodePath, qr);
          
          console.log('Código QR de WhatsApp Web generado y guardado');
        } catch (error) {
          console.error('Error al generar código QR:', error);
        }
      });
      
      this.client.on('ready', () => {
        console.log('Cliente de WhatsApp listo');
        this.status.ready = true;
        this.status.authenticated = true;
        this.status.qrCode = undefined; // Limpiar QR al estar autenticado
        this.emit('ready');
      });
      
      this.client.on('authenticated', () => {
        console.log('Autenticado en WhatsApp Web');
        this.status.authenticated = true;
      });
      
      this.client.on('auth_failure', (err: any) => {
        console.error('Error de autenticación:', err);
        this.status.authenticated = false;
        this.status.errorMessage = 'Error de autenticación en WhatsApp';
        this.emit('auth_failure', err);
      });
      
      this.client.on('disconnected', (reason: string) => {
        console.log('Desconectado de WhatsApp:', reason);
        this.status.ready = false;
        this.status.authenticated = false;
        this.emit('disconnected', reason);
      });
      
      this.client.on('message', (message: any) => {
        console.log('Mensaje recibido:', message.body);
        this.status.lastMessageAt = new Date();
        this.emit('message', message);
      });
      
      // Iniciar el cliente
      await this.client.initialize();
      this.status.initialized = true;
      
    } catch (error) {
      console.error('Error inicializando cliente real de WhatsApp:', error);
      this.status.errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.emit('error', error);
      throw error;
    }
  }
  
  // Enviar mensaje
  async sendMessage(to: string, message: string) {
    if (!this.client || !this.status.ready) {
      throw new Error('Cliente de WhatsApp no está listo');
    }
    
    try {
      // Normalizar número
      const normalizedPhone = to.replace(/[^0-9]/g, '');
      const chatId = normalizedPhone + '@c.us';
      
      console.log(`Enviando mensaje a ${chatId}: ${message}`);
      
      // Enviar mensaje
      const result = await this.client.sendMessage(chatId, message);
      
      return {
        id: result.id.id,
        timestamp: new Date(),
        status: 'sent',
        to: chatId
      };
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      throw error;
    }
  }
  
  // Obtener información del cliente
  getClientInfo() {
    if (!this.client || !this.status.ready) {
      return null;
    }
    
    return {
      info: this.client.info
    };
  }
  
  // Obtener estado actual
  getStatus() {
    if (this.client && this.status.initialized) {
      // Actualizar información del cliente si está disponible
      const clientInfo = this.getClientInfo();
      if (clientInfo) {
        this.status.clientInfo = clientInfo;
      }
    }
    
    return { ...this.status };
  }
  
  // Cerrar cliente
  async logout() {
    try {
      if (this.client) {
        console.log('Cerrando sesión de WhatsApp...');
        await this.client.logout();
        await this.client.destroy();
      }
      
      this.client = null;
      this.status = {
        initialized: false,
        ready: false,
        authenticated: false
      };
      
      this.emit('disconnected', 'Logout');
      
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  }
}

// Servicio de WhatsApp (Singleton)
class WhatsAppRealService implements IWhatsAppService {
  private client: WhatsAppClient | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private static instance: WhatsAppRealService | null = null;
  
  // Patrón singleton
  static getInstance(): WhatsAppRealService {
    if (!WhatsAppRealService.instance) {
      WhatsAppRealService.instance = new WhatsAppRealService();
    }
    return WhatsAppRealService.instance;
  }
  
  // Inicializar servicio
  async initialize(): Promise<void> {
    if (this.client) {
      console.log('WhatsApp ya está inicializado');
      return;
    }
    
    try {
      this.client = new WhatsAppClient();
      
      // Configurar listeners
      this.client.on('qr', (qr) => {
        this.notifyListeners('qr', qr);
      });
      
      this.client.on('ready', () => {
        this.notifyListeners('ready');
      });
      
      this.client.on('message', (msg) => {
        this.notifyListeners('message', msg);
        
        // Intentar encontrar un lead que coincida con este número
        this.handleIncomingMessage(msg).catch(err => 
          console.error("Error procesando mensaje entrante:", err)
        );
      });
      
      this.client.on('disconnected', (reason) => {
        this.notifyListeners('disconnected', reason);
      });
      
      this.client.on('auth_failure', (err) => {
        this.notifyListeners('auth_failure', err);
      });
      
      // Inicializar el cliente
      await this.client.initialize();
      
    } catch (error) {
      console.error('Error inicializando servicio real de WhatsApp:', error);
      this.client = null;
      throw error;
    }
  }
  
  // Reiniciar servicio
  async restart(): Promise<void> {
    if (this.client) {
      await this.client.logout().catch(err => console.error('Error al cerrar sesión:', err));
      this.client = null;
    }
    
    await this.initialize();
  }
  
  // Enviar mensaje
  async sendMessage(to: string, message: string, leadId?: number): Promise<any> {
    if (!this.client) {
      throw new Error('Cliente de WhatsApp no inicializado');
    }
    
    try {
      // Normalizar número
      const normalizedPhone = to.replace(/[^0-9]/g, '');
      
      // Enviar mensaje
      const result = await this.client.sendMessage(normalizedPhone, message);
      
      // Guardar mensaje en la base de datos
      if (leadId) {
        await storage.createMessage({
          leadId,
          content: message,
          direction: 'outgoing',
          channel: 'whatsapp',
          read: true
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error al enviar mensaje WhatsApp:', error);
      throw error;
    }
  }
  
  // Procesar mensaje entrante
  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      // Extraer número de teléfono del remitente (formato: 1234567890@c.us)
      const from = message.from;
      const phone = from.split('@')[0];
      
      // Buscar leads con este número de teléfono
      const leads = await storage.getLeadsByPhone(phone);
      
      if (leads && leads.length > 0) {
        // Si encontramos un lead, guardamos el mensaje
        const lead = leads[0];
        
        await storage.createMessage({
          leadId: lead.id,
          content: message.body,
          direction: 'incoming',
          channel: 'whatsapp',
          read: false
        });
        
        console.log(`Mensaje guardado para el lead ${lead.id}`);
      } else {
        console.log(`No se encontró ningún lead para el número ${phone}`);
      }
    } catch (error) {
      console.error("Error procesando mensaje entrante:", error);
    }
  }
  
  // Obtener QR Code
  getQrCode(): string | undefined {
    if (!this.client) {
      return undefined;
    }
    
    return this.client.getStatus().qrCode;
  }
  
  // Obtener estado actual
  getStatus(): WhatsAppStatus {
    if (!this.client) {
      return {
        initialized: false,
        ready: false,
        authenticated: false
      };
    }
    
    return this.client.getStatus();
  }
  
  // Añadir listener de eventos
  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)?.add(callback);
  }
  
  // Quitar listener de eventos
  removeEventListener(event: string, callback: Function): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(callback);
    }
  }
  
  // Notificar a todos los listeners de un evento
  private notifyListeners(event: string, ...args: any[]): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error en listener de evento ${event}:`, error);
        }
      });
    }
  }
  
  // Cerrar sesión
  async logout(): Promise<any> {
    if (!this.client) {
      return { success: true, message: 'No hay sesión activa' };
    }
    
    try {
      await this.client.logout();
      return { success: true, message: 'Sesión cerrada correctamente' };
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      return { success: false, message: 'Error al cerrar sesión', error };
    }
  }
}

// Exportar la instancia del servicio real
export const whatsappService: IWhatsAppService = WhatsAppRealService.getInstance();