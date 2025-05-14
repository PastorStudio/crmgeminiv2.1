/**
 * Este es un wrapper TypeScript para el servicio de WhatsApp en JavaScript
 */

// Importamos el tipo Express para las referencias
import type { Express } from "express";

// Definimos una interfaz para el estado de WhatsApp
export interface WhatsAppStatus {
  initialized: boolean;
  ready: boolean;
  authenticated: boolean;
  qrCode?: string;
  clientInfo?: any;
  lastMessageAt?: Date;
  errorMessage?: string;
}

// Definimos la interfaz para el servicio
export interface IWhatsAppService {
  initialize(): Promise<void>;
  restart(): Promise<void>;
  sendMessage(to: string, message: string, leadId?: number): Promise<any>;
  getQrCode(): string | undefined;
  getStatus(): WhatsAppStatus;
  addEventListener(event: string, callback: Function): void;
  removeEventListener(event: string, callback: Function): void;
  logout(): Promise<any>;
}

// Definimos una clase de fallback para el servicio
class WhatsAppServiceFallback implements IWhatsAppService {
  private status: WhatsAppStatus = {
    initialized: false,
    ready: false,
    authenticated: false,
    errorMessage: "Servicio fallback - implementación del lado del cliente"
  };
  
  async initialize(): Promise<void> {
    console.log("Inicializando servicio fallback de WhatsApp...");
    this.status.initialized = true;
    // No hacemos nada más en el fallback
  }
  
  async restart(): Promise<void> {
    return this.initialize();
  }
  
  async sendMessage(to: string, message: string, leadId?: number): Promise<any> {
    console.log(`[FALLBACK] Enviando mensaje a ${to}: ${message} (leadId: ${leadId || 'N/A'})`);
    return {
      success: true,
      simulated: true,
      to,
      message,
      timestamp: new Date().toISOString()
    };
  }
  
  getQrCode(): string | undefined {
    // En el fallback, retornamos un QR code que muestra un mensaje de error
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA..."; // QR truncado
  }
  
  getStatus(): WhatsAppStatus {
    return this.status;
  }
  
  addEventListener(event: string, callback: Function): void {
    // No hacemos nada en el fallback
  }
  
  removeEventListener(event: string, callback: Function): void {
    // No hacemos nada en el fallback
  }
  
  async logout(): Promise<any> {
    this.status = {
      initialized: false,
      ready: false,
      authenticated: false
    };
    return { success: true };
  }
}

// Intentamos importar el servicio real
let whatsappRealService: IWhatsAppService;

try {
  // Importación dinámica para compatibilidad ES Module / CommonJS
  const dynamicImport = new Function('modulePath', 'return import(modulePath)');
  
  // Importamos el servicio real (tratando de usar require dinámicamente)
  try {
    // @ts-ignore
    const jsServiceModule = require('./whatsappRealService.js');
    whatsappRealService = jsServiceModule.whatsappRealService;
    console.log("Servicio WhatsApp cargado usando require()");
  } catch (err) {
    console.warn("Error al cargar servicio usando require:", err);
    
    // Intentamos usando importación dinámica
    try {
      const jsServiceModule = dynamicImport('./whatsappRealService.js');
      whatsappRealService = (jsServiceModule as any).whatsappRealService;
      console.log("Servicio WhatsApp cargado usando import() dinámico");
    } catch (importErr) {
      console.warn("Error al cargar servicio usando import() dinámico:", importErr);
      
      // Usamos el fallback
      whatsappRealService = new WhatsAppServiceFallback();
      console.log("Usando servicio fallback de WhatsApp");
    }
  }
} catch (error) {
  console.error("Error al cargar el servicio de WhatsApp:", error);
  // Si hay error, usamos el fallback
  whatsappRealService = new WhatsAppServiceFallback();
  console.log("Usando servicio fallback de WhatsApp debido a error");
}

// Exportamos el servicio
export { whatsappRealService };