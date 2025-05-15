/**
 * Interfaz común para servicios de WhatsApp
 * Esta interfaz permite utilizar diferentes implementaciones del servicio
 * (real con whatsapp-web.js o demo con código QR funcional)
 */

export interface WhatsAppStatus {
  initialized: boolean;
  ready: boolean;
  authenticated: boolean;
  errorMessage?: string;
  qrCode?: string;
  lastMessageAt?: Date;
  clientInfo?: any;
}

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