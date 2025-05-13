import * as fs from 'fs';
import * as path from 'path';
import * as qrcode from 'qrcode';
import { EventEmitter } from 'events';
import { storage } from '../storage';
import { Lead } from '@shared/schema';
import { Client } from 'whatsapp-web.js';

// Interface para status de conexión
interface WhatsAppStatus {
  initialized: boolean;
  ready: boolean;
  authenticated: boolean;
  qrCode?: string;
  clientInfo?: any;
  lastMessageAt?: Date;
  errorMessage?: string;
}

// Clase para manejar la conexión de WhatsApp usando whatsapp-web.js
class WhatsAppClient extends EventEmitter {
  private static qrCodePath = path.join(process.cwd(), 'temp', 'whatsapp-qr.png');
  private status: WhatsAppStatus;
  private simulationMode: boolean = process.env.WHATSAPP_SIMULATION !== 'false'; // Por defecto usar simulación
  private simulatedLeads: Map<string, number> = new Map(); // Mapeo de teléfonos a leadIds
  private client: Client | null = null;
  
  constructor() {
    super();
    this.status = {
      initialized: false,
      ready: false,
      authenticated: false
    };
    
    // Crear directorio temp si no existe
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  }
  
  // Inicializar el cliente
  async initialize(): Promise<void> {
    try {
      if (this.simulationMode) {
        // Modo simulación para desarrollo
        console.log("Inicializando WhatsApp (modo simulación)...");
        this.status.initialized = true;
        this.status.ready = false;
        this.status.authenticated = false;
        
        // Generar un código QR aleatorio para simular
        const randomQR = Math.random().toString(16).substr(2, 16);
        console.log(`Generando código QR para WhatsApp (simulado): ${randomQR}`);
        
        // Generar el código QR como imagen y como data URL
        const qrImage = await qrcode.toString(randomQR, { type: 'terminal' });
        const qrDataURL = await qrcode.toDataURL(randomQR);
        
        console.log(qrImage); // Mostrar QR en consola
        this.status.qrCode = qrDataURL;
        
        // Emitir evento de código QR
        this.emit('qr', qrDataURL);
        
        // Simular autenticación después de un tiempo aleatorio
        const authDelay = Math.floor(Math.random() * 30000) + 5000; // 5-35 segundos
        setTimeout(() => {
          console.log("WhatsApp: simulando autenticación del usuario...");
          this.status.authenticated = true;
          this.status.ready = true;
          this.status.qrCode = undefined;
          
          this.emit('ready');
          console.log("Cliente de WhatsApp listo! (simulado)");
        }, authDelay);
        
        // Cargar información de leads para simulación
        this.loadSimulatedLeads();
      } else {
        // Modo real usando whatsapp-web.js
        console.log("Inicializando WhatsApp (modo real)...");
        this.status.initialized = true;
        this.status.ready = false;
        this.status.authenticated = false;
        
        // Inicializar cliente de WhatsApp Web
        this.client = new Client({
          puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        });
        
        // Configurar eventos
        this.client.on('qr', (qrCode) => {
          console.log('Recibido código QR de WhatsApp, generando imagen...');
          
          // Convertir a data URL para mostrar en la interfaz
          qrcode.toDataURL(qrCode, (err, dataURL) => {
            if (err) {
              console.error('Error al convertir código QR a data URL:', err);
              return;
            }
            
            this.status.qrCode = dataURL;
            this.emit('qr', dataURL);
          });
        });
        
        this.client.on('ready', () => {
          console.log('Cliente WhatsApp Web está listo!');
          this.status.ready = true;
          this.status.authenticated = true;
          this.status.qrCode = undefined;
          this.emit('ready');
        });
        
        this.client.on('authenticated', () => {
          console.log('Autenticación exitosa con WhatsApp!');
          this.status.authenticated = true;
        });
        
        this.client.on('auth_failure', (msg) => {
          console.error('Error de autenticación de WhatsApp:', msg);
          this.status.errorMessage = msg;
          this.emit('error', new Error(msg));
        });
        
        this.client.on('disconnected', (reason) => {
          console.log('Cliente WhatsApp desconectado:', reason);
          this.status.ready = false;
          this.status.authenticated = false;
          this.emit('disconnected', reason);
        });
        
        // Configurar manejador de mensajes entrantes
        this.client.on('message', async (msg) => {
          try {
            console.log(`[WhatsApp] Mensaje recibido de ${msg.from}: ${msg.body}`);
            
            // Obtener número de teléfono del formato @c.us de WhatsApp
            const phone = msg.from.split('@')[0];
            
            // Buscar lead por número de teléfono o crear uno nuevo
            let leadId: number;
            const leads = await storage.getLeadsByPhone(phone);
            
            if (leads && leads.length > 0) {
              // Usar lead existente
              leadId = leads[0].id;
              console.log(`[WhatsApp] Lead existente encontrado: ${leadId}`);
            } else {
              // Crear nuevo lead
              const newLead = await storage.createLead({
                fullName: `Contacto WhatsApp ${phone.substr(-4)}`,
                email: `whatsapp_${phone}@example.com`,
                phone: phone,
                source: "whatsapp",
                status: "nuevo"
              });
              
              leadId = newLead.id;
              console.log(`[WhatsApp] Creado nuevo lead ID ${leadId} para ${phone}`);
            }
            
            // Guardar mensaje en la base de datos
            await storage.createMessage({
              leadId,
              content: msg.body,
              direction: "incoming",
              channel: "whatsapp",
              read: false
            });
            
            console.log(`[WhatsApp] Mensaje guardado para leadId ${leadId}`);
            
            // Emitir evento para notificar a los suscriptores
            this.emit('message', {
              from: phone,
              body: msg.body,
              leadId,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('[WhatsApp] Error procesando mensaje entrante:', error);
          }
        });
        
        // Iniciar el cliente
        await this.client.initialize();
      }
    } catch (error) {
      console.error("Error inicializando WhatsApp:", error);
      this.status.errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.emit('error', error);
    }
  }
  
  // Enviar mensaje
  async sendMessage(to: string, message: string): Promise<any> {
    if (!this.status.ready) {
      throw new Error("WhatsApp client is not ready");
    }
    
    // Normalizar número de teléfono
    const normalizedPhone = this.normalizePhoneNumber(to);
    
    console.log(`[WhatsApp] Enviando mensaje a ${normalizedPhone}: ${message}`);
    
    try {
      // En modo simulación, simplemente registramos el mensaje y devolvemos un ID simulado
      if (this.simulationMode) {
        const messageId = `simulated_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Si tenemos un leadId asociado a este número, guardar el mensaje en la BD
        const leadId = this.simulatedLeads.get(normalizedPhone);
        if (leadId) {
          try {
            await storage.createMessage({
              leadId,
              content: message,
              direction: "outgoing",
              channel: "whatsapp",
              read: false
            });
            console.log(`[WhatsApp] Mensaje guardado para leadId ${leadId}`);
          } catch (error) {
            console.error(`[WhatsApp] Error guardando mensaje para leadId ${leadId}:`, error);
          }
        }
        
        return { id: messageId, status: 'sent' };
      } else {
        // Implementación real con la biblioteca whatsapp-web.js
        if (!this.client) {
          throw new Error("Cliente de WhatsApp no inicializado");
        }
        
        // Formatear número según formato esperado por whatsapp-web.js
        const formattedNumber = `${normalizedPhone}@c.us`;
        
        // Enviar mensaje
        const response = await this.client.sendMessage(formattedNumber, message);
        
        console.log(`[WhatsApp] Mensaje enviado con ID: ${response.id.id}`);
        
        return { 
          id: response.id.id, 
          status: 'sent' 
        };
      }
    } catch (error) {
      console.error(`[WhatsApp] Error enviando mensaje a ${normalizedPhone}:`, error);
      throw error;
    }
  }
  
  // Obtener estado actual
  getStatus(): WhatsAppStatus {
    return { ...this.status };
  }
  
  // Obtener código QR actual
  getQrCode(): string | undefined {
    return this.status.qrCode;
  }
  
  // Cerrar sesión
  async logout(): Promise<void> {
    try {
      if (this.simulationMode) {
        console.log("[WhatsApp] Cerrando sesión (simulado)");
        this.status.authenticated = false;
        this.status.ready = false;
        return;
      } else {
        // Implementación real
        if (!this.client) {
          throw new Error("Cliente de WhatsApp no inicializado");
        }
        
        console.log("[WhatsApp] Cerrando sesión...");
        await this.client.logout();
        console.log("[WhatsApp] Sesión cerrada correctamente");
        
        this.status.authenticated = false;
        this.status.ready = false;
        this.status.qrCode = undefined;
      }
    } catch (error) {
      console.error("[WhatsApp] Error al cerrar sesión:", error);
      throw error;
    }
  }
  
  // Funciones auxiliares
  private normalizePhoneNumber(phone: string): string {
    // Eliminar todos los caracteres que no sean números
    let normalized = phone.replace(/\D/g, '');
    
    // Asegurarse de que tenga el formato correcto con código de país
    if (!normalized.startsWith('1') && !normalized.startsWith('52') && !normalized.startsWith('34')) {
      // Añadir código de país por defecto (52 para México)
      normalized = '52' + normalized;
    }
    
    return normalized;
  }
  
  // Cargar leads para simulación
  private async loadSimulatedLeads() {
    try {
      const leads = await storage.getAllLeads();
      
      // Mapear números de teléfono a leadIds
      leads.forEach(lead => {
        if (lead.phone) {
          const normalized = this.normalizePhoneNumber(lead.phone);
          this.simulatedLeads.set(normalized, lead.id);
        }
        
        if (lead.whatsappPhone && lead.whatsappPhone !== lead.phone) {
          const normalized = this.normalizePhoneNumber(lead.whatsappPhone);
          this.simulatedLeads.set(normalized, lead.id);
        }
      });
      
      console.log(`[WhatsApp] Cargados ${this.simulatedLeads.size} números de teléfono para simulación`);
    } catch (error) {
      console.error("[WhatsApp] Error cargando leads para simulación:", error);
    }
  }
  
  // Simular recepción de mensaje (para pruebas)
  async simulateIncomingMessage(from: string, message: string): Promise<void> {
    const normalizedPhone = this.normalizePhoneNumber(from);
    const leadId = this.simulatedLeads.get(normalizedPhone);
    
    if (!leadId) {
      console.warn(`[WhatsApp] No se encontró lead para el número ${normalizedPhone}`);
      return;
    }
    
    try {
      await storage.createMessage({
        leadId,
        content: message,
        direction: "incoming",
        channel: "whatsapp",
        read: false
      });
      
      console.log(`[WhatsApp] Mensaje entrante simulado de ${normalizedPhone} (Lead ID: ${leadId}): ${message}`);
      this.emit('message', { from: normalizedPhone, body: message, leadId });
    } catch (error) {
      console.error(`[WhatsApp] Error guardando mensaje entrante simulado:`, error);
    }
  }
}

// Singleton para gestionar la instancia de WhatsApp
export class WhatsAppService {
  private static instance: WhatsAppService;
  private client: WhatsAppClient | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  private constructor() {
    // Constructor privado para patrón singleton
    // Por ahora usar simulación debido a problemas con dependencias de sistema para Puppeteer
    process.env.WHATSAPP_SIMULATION = 'true';
  }
  
  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }
  
  // Inicializar el servicio
  async initialize(): Promise<void> {
    if (this.client) {
      console.log("WhatsApp ya está inicializado");
      return;
    }
    
    try {
      this.client = new WhatsAppClient();
      
      // Configurar listeners de eventos
      this.client.on('qr', (qr) => {
        this.notifyListeners('qr', qr);
      });
      
      this.client.on('ready', () => {
        this.notifyListeners('ready');
      });
      
      this.client.on('message', (msg) => {
        this.notifyListeners('message', msg);
      });
      
      this.client.on('error', (err) => {
        this.notifyListeners('error', err);
      });
      
      await this.client.initialize();
    } catch (error) {
      console.error("Error inicializando servicio WhatsApp:", error);
      throw error;
    }
  }
  
  // Reiniciar el cliente
  async restart(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch (error) {
        console.error("Error al cerrar sesión durante reinicio:", error);
      }
      this.client = null;
    }
    
    return this.initialize();
  }
  
  // Enviar mensaje
  async sendMessage(to: string, message: string, leadId?: number): Promise<any> {
    if (!this.client) {
      throw new Error("WhatsApp no está inicializado");
    }
    
    // Si se proporciona leadId, guardar mensaje en BD primero
    if (leadId) {
      try {
        await storage.createMessage({
          leadId,
          content: message,
          direction: "outgoing",
          channel: "whatsapp",
          read: true
        });
      } catch (error) {
        console.error("Error guardando mensaje en BD:", error);
      }
    }
    
    return this.client.sendMessage(to, message);
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
  
  // Obtener código QR
  getQrCode(): string | undefined {
    if (!this.client) {
      return undefined;
    }
    
    return this.client.getQrCode();
  }
  
  // Añadir event listener
  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)?.add(callback);
  }
  
  // Eliminar event listener
  removeEventListener(event: string, callback: Function): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(callback);
    }
  }
  
  // Notificar a los listeners
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
  
  // Para simulación - crear mensaje entrante
  async simulateIncomingMessage(from: string, message: string): Promise<void> {
    if (!this.client) {
      throw new Error("WhatsApp no está inicializado");
    }
    
    return (this.client as WhatsAppClient).simulateIncomingMessage(from, message);
  }
  
  // Cerrar sesión de WhatsApp
  async logout(): Promise<any> {
    if (!this.client) {
      return { success: true, message: "No hay sesión activa" };
    }
    
    try {
      await this.client.logout();
      this.client = null;
      return { success: true, message: "Sesión cerrada correctamente" };
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      throw error;
    }
  }
}

// Instancia exportada para uso global
export const whatsappService = WhatsAppService.getInstance();