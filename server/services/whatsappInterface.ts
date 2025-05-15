/**
 * Interfaz común para el servicio de WhatsApp
 * Define los métodos y tipos necesarios para la integración con WhatsApp
 */

/**
 * Estado del servicio de WhatsApp
 */
export interface WhatsAppStatus {
  initialized: boolean;
  ready: boolean;
  authenticated: boolean;
  error?: string;
  qrCode?: string;
  qrDataUrl?: string;  // URL de datos para mostrar directamente en frontend
}

/**
 * Interfaz del servicio de WhatsApp
 */
export interface IWhatsAppService {
  /**
   * Inicializa el cliente de WhatsApp
   */
  initialize(): Promise<void>;
  
  /**
   * Obtiene el estado actual del servicio
   */
  getStatus(): WhatsAppStatus;
  
  /**
   * Reinicia el servicio de WhatsApp
   */
  restart(): Promise<void>;
  
  /**
   * Cierra la sesión actual
   */
  logout(): Promise<void>;
  
  /**
   * Envía un mensaje de WhatsApp al número especificado
   * @param phoneNumber Número de teléfono del destinatario
   * @param message Mensaje a enviar
   */
  sendMessage(phoneNumber: string, message: string): Promise<any>;
}