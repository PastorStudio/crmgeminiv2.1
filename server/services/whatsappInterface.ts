/**
 * Servicio de WhatsApp simplificado directamente en TypeScript
 */

import { storage } from "../storage";

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