/**
 * Sistema de notificaciones en tiempo real para WhatsApp CRM
 * Maneja detección de mensajes nuevos y notificaciones push
 */

import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export interface NotificationMessage {
  id: string;
  type: 'new_message' | 'status_change' | 'system_alert' | 'demo_created';
  chatId: string;
  accountId: number;
  title: string;
  message: string;
  timestamp: number;
  urgent?: boolean;
  data?: any;
}

class NotificationService extends EventEmitter {
  private static instance: NotificationService;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private lastMessageTimestamps: Map<string, number> = new Map();

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Inicializa el servidor WebSocket para notificaciones
   */
  initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/notifications',
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('🔔 Nueva conexión de notificaciones establecida');
      this.clients.add(ws);

      // Enviar mensaje de bienvenida
      this.sendToClient(ws, {
        id: 'welcome',
        type: 'system_alert',
        chatId: '',
        accountId: 0,
        title: 'Conectado',
        message: 'Sistema de notificaciones activo',
        timestamp: Date.now()
      });

      ws.on('close', () => {
        console.log('🔔 Conexión de notificaciones cerrada');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ Error en WebSocket de notificaciones:', error);
        this.clients.delete(ws);
      });

      // Mantener conexión activa
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
          this.clients.delete(ws);
        }
      }, 30000);
    });

    console.log('🔔 Servicio de notificaciones inicializado en /notifications');
  }

  /**
   * Envía notificación a un cliente específico
   */
  private sendToClient(client: WebSocket, notification: NotificationMessage) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(notification));
      } catch (error) {
        console.error('❌ Error enviando notificación:', error);
        this.clients.delete(client);
      }
    }
  }

  /**
   * Envía notificación a todos los clientes conectados
   */
  broadcast(notification: NotificationMessage) {
    console.log(`🔔 Enviando notificación: ${notification.title}`);
    
    this.clients.forEach(client => {
      this.sendToClient(client, notification);
    });

    // Limpiar clientes desconectados
    this.clients = new Set([...this.clients].filter(client => 
      client.readyState === WebSocket.OPEN
    ));
  }

  /**
   * Notifica sobre un nuevo mensaje
   */
  notifyNewMessage(chatId: string, accountId: number, messageData: any) {
    const now = Date.now();
    const lastTimestamp = this.lastMessageTimestamps.get(chatId) || 0;
    
    // Solo notificar si es un mensaje realmente nuevo (más de 2 segundos de diferencia)
    if (now - lastTimestamp > 2000) {
      this.lastMessageTimestamps.set(chatId, now);
      
      const notification: NotificationMessage = {
        id: `msg_${chatId}_${now}`,
        type: 'new_message',
        chatId,
        accountId,
        title: 'Nuevo mensaje',
        message: `Mensaje de ${messageData.contactName || 'Contacto'}`,
        timestamp: now,
        urgent: true,
        data: messageData
      };

      this.broadcast(notification);
    }
  }

  /**
   * Notifica creación de nuevo demo
   */
  notifyDemoCreated(customerName: string, accountId: number, chatId: string, demoData: any) {
    const notification: NotificationMessage = {
      id: `demo_${accountId}_${Date.now()}`,
      type: 'demo_created',
      chatId,
      accountId,
      title: '🎉🎊 ¡Nuevo Demo Creado! 🎊🎉',
      message: `Demo creado para ${customerName}\n👤 Usuario: ${demoData.username}`,
      timestamp: Date.now(),
      urgent: true,
      data: {
        customerName,
        username: demoData.username,
        phoneNumber: demoData.phoneNumber,
        expiresAt: demoData.expiresAt,
        loginUrl: demoData.loginUrl,
        celebrationIcon: '🎉🎊🥳'
      }
    };

    this.broadcast(notification);
  }

  /**
   * Notifica cambio de estado de WhatsApp
   */
  notifyStatusChange(accountId: number, status: string, details?: any) {
    const notification: NotificationMessage = {
      id: `status_${accountId}_${Date.now()}`,
      type: 'status_change',
      chatId: '',
      accountId,
      title: 'Estado WhatsApp',
      message: `Cuenta ${accountId}: ${status}`,
      timestamp: Date.now(),
      data: { status, details }
    };

    this.broadcast(notification);
  }

  /**
   * Notifica alertas del sistema
   */
  notifySystemAlert(title: string, message: string, urgent = false) {
    const notification: NotificationMessage = {
      id: `alert_${Date.now()}`,
      type: 'system_alert',
      chatId: '',
      accountId: 0,
      title,
      message,
      timestamp: Date.now(),
      urgent
    };

    this.broadcast(notification);
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      isActive: this.wss !== null,
      lastMessageTimestamps: this.lastMessageTimestamps.size
    };
  }
}

export const notificationService = NotificationService.getInstance();