/**
 * Implementación real del servicio de WhatsApp utilizando whatsapp-web.js y Chromium
 * Genera códigos QR auténticos para conexión con WhatsApp Web
 */

import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { IWhatsAppService, WhatsAppStatus } from './whatsappInterface';
import { EventEmitter } from 'events';

// Directorio temporal para archivos
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Directorio para sesiones de WhatsApp
const SESSION_PATH = path.join(TEMP_DIR, 'whatsapp-sessions');
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

// Archivo para guardar el QR en texto
const QR_TEXT_FILE = path.join(TEMP_DIR, 'whatsapp-qr.txt');

/**
 * Clase que implementa el servicio de WhatsApp usando whatsapp-web.js
 */
class WhatsAppServiceImpl extends EventEmitter implements IWhatsAppService {
  private client: Client | null = null;
  private status: WhatsAppStatus = {
    initialized: false,
    ready: false,
    authenticated: false,
    error: undefined,
    qrCode: undefined
  };

  /**
   * Obtiene la ruta al ejecutable de Chromium en Replit
   */
  private getChromiumExecutablePath(): string {
    // En Replit, Chromium se instala aquí
    const replitChromiumPath = '/nix/store/x205pbkd5xh5g5iack1dxfcms3cz2549-chromium-108.0.5359.94/bin/chromium';
    
    if (fs.existsSync(replitChromiumPath)) {
      console.log('Usando Chromium de Replit:', replitChromiumPath);
      return replitChromiumPath;
    }
    
    // Intentar ubicación alternativa
    try {
      const whichChromium = require('child_process').execSync('which chromium').toString().trim();
      if (whichChromium && fs.existsSync(whichChromium)) {
        console.log('Usando Chromium encontrado en:', whichChromium);
        return whichChromium;
      }
    } catch (error) {
      console.warn('No se pudo determinar la ubicación de Chromium mediante "which"');
    }
    
    throw new Error('No se pudo encontrar el ejecutable de Chromium');
  }

  /**
   * Inicializa el cliente de WhatsApp Web
   */
  async initialize(): Promise<void> {
    try {
      if (this.client) {
        console.log('Cliente WhatsApp ya inicializado');
        return;
      }

      console.log('Inicializando cliente de WhatsApp Web...');

      // Configuración de puppeteer para Replit
      const puppeteerOptions = {
        executablePath: this.getChromiumExecutablePath(),
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
      };

      // Inicializamos el cliente con la configuración de puppeteer
      this.client = new Client({
        puppeteer: puppeteerOptions
      });

      // Configuramos los eventos del cliente
      this.setupClientEvents();

      // Iniciamos el cliente
      await this.client.initialize();
      
      this.status.initialized = true;
      console.log('Cliente de WhatsApp Web inicializado exitosamente');
      
    } catch (error) {
      console.error('Error al inicializar WhatsApp:', error);
      this.status.error = `Error al inicializar: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      this.status.initialized = true;
      this.status.ready = false;
      throw error;
    }
  }

  /**
   * Configura los eventos del cliente de WhatsApp
   */
  private setupClientEvents(): void {
    if (!this.client) return;

    // Evento cuando se genera un código QR
    this.client.on('qr', async (qrText) => {
      console.log('Nuevo código QR recibido');
      
      // Guardamos el QR en un archivo de texto para depuración
      fs.writeFileSync(QR_TEXT_FILE, qrText);
      console.log('Código QR guardado en archivo:', QR_TEXT_FILE);
      
      try {
        // Generamos una imagen data URL del código QR
        const qrDataUrl = await qrcode.toDataURL(qrText, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          margin: 4,
          scale: 4,
          color: {
            dark: '#128C7E',  // Color principal de WhatsApp
            light: '#FFFFFF'
          }
        });
        
        // Actualizamos el estado
        this.status.qrCode = qrText;
        this.status.ready = true;
        this.status.qrDataUrl = qrDataUrl;  // Guardamos el dataURL para mostrarlo en frontend
        
        // Emitimos evento para notificar al frontend
        this.emit('qr', { qrText, qrDataUrl });
        
      } catch (error) {
        console.error('Error generando imagen QR:', error);
        this.status.error = 'Error generando imagen QR';
        this.status.qrCode = qrText;  // Al menos guardamos el texto del QR
      }
    });

    // Evento cuando el cliente está listo
    this.client.on('ready', () => {
      console.log('Cliente WhatsApp listo para usar');
      this.status.ready = true;
      this.status.authenticated = true;
      this.status.qrCode = undefined;
      this.status.error = undefined;
      this.emit('ready');
    });

    // Evento cuando la autenticación falla
    this.client.on('auth_failure', (error) => {
      console.error('Error de autenticación WhatsApp:', error);
      this.status.authenticated = false;
      this.status.error = `Error de autenticación: ${error}`;
      this.emit('auth_failure', error);
    });

    // Evento cuando se desconecta
    this.client.on('disconnected', (reason) => {
      console.log('Cliente WhatsApp desconectado:', reason);
      this.status.authenticated = false;
      this.status.ready = false;
      this.status.error = `Desconectado: ${reason}`;
      this.emit('disconnected', reason);
    });

    // Evento para mensajes entrantes
    this.client.on('message', (message) => {
      console.log('Mensaje recibido:', message.body);
      this.emit('message', message);
    });
  }

  /**
   * Obtiene el estado actual del servicio
   */
  getStatus(): WhatsAppStatus {
    return this.status;
  }

  /**
   * Reinicia el servicio de WhatsApp
   */
  async restart(): Promise<void> {
    try {
      console.log('Reiniciando servicio de WhatsApp...');
      
      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      
      // Resetear estado
      this.status = {
        initialized: false,
        ready: false,
        authenticated: false,
        error: undefined,
        qrCode: undefined
      };
      
      // Volvemos a inicializar
      await this.initialize();
      
    } catch (error) {
      console.error('Error al reiniciar servicio de WhatsApp:', error);
      this.status.error = `Error al reiniciar: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      throw error;
    }
  }

  /**
   * Cierra la sesión actual
   */
  async logout(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Cliente no inicializado');
      }

      await this.client.logout();
      
      // Reiniciamos el cliente para generar nuevo QR
      await this.restart();
      
    } catch (error) {
      console.error('Error al cerrar sesión de WhatsApp:', error);
      this.status.error = `Error al cerrar sesión: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      throw error;
    }
  }

  /**
   * Envía un mensaje de WhatsApp al número especificado
   */
  async sendMessage(phoneNumber: string, message: string): Promise<any> {
    try {
      if (!this.client || !this.status.authenticated) {
        throw new Error('Cliente no inicializado o no autenticado');
      }

      // Formato estándar para números internacionales en WhatsApp (sin el +)
      let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
      
      // Añadir @c.us que es el formato que espera WhatsApp Web
      const chatId = `${formattedNumber}@c.us`;
      
      // Enviar el mensaje
      const response = await this.client.sendMessage(chatId, message);
      
      console.log(`Mensaje enviado a ${phoneNumber}:`, message);
      
      return {
        success: true,
        messageId: response.id._serialized,
        to: phoneNumber,
        message: message
      };
      
    } catch (error) {
      console.error(`Error enviando mensaje a ${phoneNumber}:`, error);
      throw error;
    }
  }
}

// Exportamos una instancia del servicio
export const whatsappService = new WhatsAppServiceImpl();