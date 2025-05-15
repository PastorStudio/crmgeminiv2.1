/**
 * Implementación real del servicio de WhatsApp utilizando la biblioteca whatsapp-web.js
 * Esta implementación proporciona código QR oficial de WhatsApp Web
 */

import * as path from 'path';
import * as fs from 'fs';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { IWhatsAppService, WhatsAppStatus } from "./whatsappInterface";
import { storage } from "../storage";
import puppeteer from 'puppeteer-core';

// Directorio temporal para archivos
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Configuración para WhatsApp Web (session, chromium, etc)
const SESSION_PATH = path.join(TEMP_DIR, 'whatsapp-sessions');
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

/**
 * Implementación del servicio WhatsApp usando la biblioteca oficial whatsapp-web.js
 */
class WhatsAppServiceImpl implements IWhatsAppService {
  private client: Client | null = null;
  private status: WhatsAppStatus;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private static instance: WhatsAppServiceImpl | null = null;
  
  private constructor() {
    this.status = {
      initialized: false,
      ready: false,
      authenticated: false,
      qrCode: undefined,
      errorMessage: undefined
    };
  }
  
  // Patrón singleton para asegurar una única instancia
  static getInstance(): WhatsAppServiceImpl {
    if (!WhatsAppServiceImpl.instance) {
      WhatsAppServiceImpl.instance = new WhatsAppServiceImpl();
    }
    return WhatsAppServiceImpl.instance;
  }
  
  /**
   * Inicializa el cliente de WhatsApp Web con configuración para usar el chromium instalado
   */
  async initialize(): Promise<void> {
    if (this.client) {
      console.log('El cliente de WhatsApp ya está inicializado');
      return;
    }
    
    try {
      console.log('Iniciando servicio de WhatsApp con Chromium...');
      
      // Encontrar el ejecutable de Chromium
      console.log('Intentando crear navegador con Puppeteer...');
      let executablePath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
      
      // Verificar si podemos lanzar el navegador directamente
      try {
        const browser = await puppeteer.launch({
          executablePath,
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
        });
        
        console.log('Navegador Puppeteer creado exitosamente');
        await browser.close();
      } catch (error) {
        console.error('Error al lanzar navegador con Puppeteer:', error);
        throw new Error('No se pudo inicializar el navegador: ' + (error instanceof Error ? error.message : String(error)));
      }
      
      // Configurar el cliente de WhatsApp Web
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: SESSION_PATH
        }),
        puppeteer: {
          executablePath,
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
      
      // Evento: Código QR generado
      this.client.on('qr', (qr) => {
        console.log('Código QR de WhatsApp Web generado');
        this.status.qrCode = qr;
        this.notifyListeners('qr', qr);
      });
      
      // Evento: Cliente listo
      this.client.on('ready', () => {
        console.log('Cliente de WhatsApp Web listo');
        this.status.ready = true;
        this.status.authenticated = true;
        this.status.qrCode = undefined; // Limpiar QR cuando el cliente está autenticado
        this.notifyListeners('ready');
      });
      
      // Evento: Autenticación correcta
      this.client.on('authenticated', () => {
        console.log('Cliente de WhatsApp Web autenticado');
        this.status.authenticated = true;
        this.notifyListeners('authenticated');
      });
      
      // Evento: Mensaje recibido
      this.client.on('message', async (message) => {
        console.log('Mensaje recibido:', message.body);
        
        // Si el mensaje tiene un chat grupal, extraer información adicional
        const chat = await message.getChat();
        const contact = await message.getContact();
        
        // Estructurar información del mensaje
        const messageInfo = {
          id: message.id.id,
          body: message.body,
          from: message.from,
          to: message.to,
          fromName: contact.pushname || contact.name || contact.number,
          timestamp: message.timestamp,
          isGroup: chat.isGroup,
          groupName: chat.isGroup ? chat.name : undefined
        };
        
        // Notificar a listeners
        this.notifyListeners('message', messageInfo);
        
        // TODO: Guardar en base de datos (implementar lógica para asociar número con lead)
      });
      
      // Evento: Autenticación fallida
      this.client.on('auth_failure', (error) => {
        console.error('Error de autenticación en WhatsApp Web:', error);
        this.status.authenticated = false;
        this.status.errorMessage = 'Error de autenticación: ' + error;
        this.notifyListeners('auth_failure', error);
      });
      
      // Evento: Desconexión
      this.client.on('disconnected', (reason) => {
        console.log('Cliente de WhatsApp Web desconectado:', reason);
        this.status.ready = false;
        this.status.authenticated = false;
        this.status.errorMessage = 'Desconectado: ' + reason;
        this.notifyListeners('disconnected', reason);
      });
      
      // Inicializar cliente
      console.log('Inicializando cliente real de WhatsApp...');
      try {
        this.status.initialized = true;
        await this.client.initialize();
        console.log('Cliente de WhatsApp Web inicializado exitosamente');
      } catch (error) {
        console.error('Error inicializando cliente real de WhatsApp:', error);
        this.status.errorMessage = 'Error de inicialización: ' + (error instanceof Error ? error.message : String(error));
        this.status.initialized = false;
        this.client = null;
        throw error;
      }
      
    } catch (error) {
      console.error('Error inicializando servicio real de WhatsApp:', error);
      this.status.errorMessage = 'Error: ' + (error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * Reinicia el cliente de WhatsApp
   */
  async restart(): Promise<void> {
    try {
      console.log('Reiniciando servicio de WhatsApp...');
      
      // Si hay un cliente activo, cerrarlo primero
      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      
      // Resetear estado
      this.status = {
        initialized: false,
        ready: false,
        authenticated: false,
        qrCode: undefined,
        errorMessage: undefined
      };
      
      // Inicializar de nuevo
      await this.initialize();
    } catch (error) {
      console.error('Error reiniciando servicio de WhatsApp:', error);
      this.status.errorMessage = 'Error al reiniciar: ' + (error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * Enviar mensaje de WhatsApp
   */
  async sendMessage(to: string, message: string, leadId?: number): Promise<any> {
    if (!this.client || !this.status.ready) {
      throw new Error('Cliente de WhatsApp no inicializado o no listo');
    }
    
    try {
      // Formatear el número de teléfono para WhatsApp
      const normalizedPhone = this.formatPhoneNumber(to);
      
      // Enviar mensaje
      const msg = await this.client.sendMessage(`${normalizedPhone}@c.us`, message);
      
      // Guardar mensaje en la base de datos si corresponde
      if (leadId) {
        await storage.createMessage({
          leadId,
          content: message,
          direction: 'outgoing',
          channel: 'whatsapp',
          read: true
        });
      }
      
      // Devolver información del mensaje enviado
      return {
        id: msg.id.id,
        timestamp: msg.timestamp,
        status: 'sent',
        to: normalizedPhone
      };
    } catch (error) {
      console.error('Error al enviar mensaje de WhatsApp:', error);
      throw new Error('Error al enviar mensaje: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * Formatear número de teléfono para WhatsApp
   * Elimina todos los caracteres no numéricos excepto el signo +
   */
  private formatPhoneNumber(phone: string): string {
    // Eliminar todos los caracteres no numéricos excepto el signo +
    let formatted = phone.replace(/[^0-9+]/g, '');
    
    // Si comienza con +, eliminar el + y mantener el resto
    if (formatted.startsWith('+')) {
      formatted = formatted.substring(1);
    }
    
    return formatted;
  }
  
  /**
   * Obtener el código QR actual
   */
  getQrCode(): string | undefined {
    return this.status.qrCode;
  }
  
  /**
   * Obtener el estado actual del servicio
   */
  getStatus(): WhatsAppStatus {
    return { ...this.status };
  }
  
  /**
   * Añadir un listener para eventos
   */
  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)?.add(callback);
  }
  
  /**
   * Eliminar un listener
   */
  removeEventListener(event: string, callback: Function): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(callback);
    }
  }
  
  /**
   * Notificar a todos los listeners de un evento
   */
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
  
  /**
   * Cerrar sesión del cliente
   */
  async logout(): Promise<any> {
    if (!this.client) {
      return { success: true, message: 'No hay sesión activa' };
    }
    
    try {
      // Cerrar sesión
      await this.client.logout();
      
      // Destruir cliente
      await this.client.destroy();
      this.client = null;
      
      // Actualizar estado
      this.status.authenticated = false;
      this.status.ready = false;
      this.status.qrCode = undefined;
      
      // Notificar
      this.notifyListeners('logout');
      
      return { success: true, message: 'Sesión cerrada correctamente' };
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      return { 
        success: false, 
        message: 'Error al cerrar sesión', 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Exportar la instancia singleton del servicio
export const whatsappService: IWhatsAppService = WhatsAppServiceImpl.getInstance();