/**
 * Sistema de notificaciones WebSocket en tiempo real
 * Maneja notificaciones de mensajes nuevos de WhatsApp
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

interface NotificationData {
  type: 'new_message' | 'status_update' | 'notification';
  message?: any;
  data?: any;
  timestamp: number;
}

interface ConnectedClient {
  id: string;
  socket: WebSocket;
  userId?: number;
  isAlive: boolean;
  lastPing: number;
}

export class NotificationWebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Inicializa el servidor WebSocket para notificaciones
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/notifications-ws',
      perMessageDeflate: false 
    });

    this.wss.on('connection', (socket, request) => {
      const clientId = this.generateClientId();
      const client: ConnectedClient = {
        id: clientId,
        socket,
        isAlive: true,
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);
      console.log(`🔔 Cliente de notificaciones conectado: ${clientId}`);

      // Configurar eventos del cliente
      this.setupClientEvents(client);

      // Enviar confirmación de conexión
      this.sendToClient(clientId, {
        type: 'notification',
        data: {
          title: 'Sistema conectado',
          message: 'Notificaciones en tiempo real activadas'
        },
        timestamp: Date.now()
      });
    });

    // Iniciar sistema de ping/pong para mantener conexiones vivas
    this.startPingInterval();

    console.log('🔔 Servidor WebSocket de notificaciones iniciado en /notifications-ws');
  }

  /**
   * Configura eventos para un cliente conectado
   */
  private setupClientEvents(client: ConnectedClient): void {
    client.socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        console.error('Error procesando mensaje del cliente:', error);
      }
    });

    client.socket.on('pong', () => {
      client.isAlive = true;
      client.lastPing = Date.now();
    });

    client.socket.on('close', () => {
      console.log(`🔔 Cliente desconectado: ${client.id}`);
      this.clients.delete(client.id);
    });

    client.socket.on('error', (error) => {
      console.error(`Error en cliente ${client.id}:`, error);
      this.clients.delete(client.id);
    });
  }

  /**
   * Maneja mensajes recibidos de los clientes
   */
  private handleClientMessage(client: ConnectedClient, message: any): void {
    switch (message.type) {
      case 'auth':
        client.userId = message.userId;
        console.log(`🔔 Cliente ${client.id} autenticado como usuario ${client.userId}`);
        break;
      case 'ping':
        this.sendToClient(client.id, { type: 'notification', data: { message: 'pong' }, timestamp: Date.now() });
        break;
    }
  }

  /**
   * Envía notificación de mensaje nuevo a todos los clientes conectados
   */
  notifyNewMessage(message: any): void {
    const notification: NotificationData = {
      type: 'new_message',
      message: {
        id: message.id,
        from: message.from,
        body: message.body,
        timestamp: message.timestamp,
        fromMe: message.fromMe,
        chatId: message.chatId,
        contactName: message.contactName,
        isGroup: message.isGroup
      },
      timestamp: Date.now()
    };

    this.broadcast(notification);
    console.log(`🔔 Notificación de mensaje nuevo enviada: ${message.chatId}`);
  }

  /**
   * Envía notificación general a todos los clientes
   */
  sendNotification(title: string, message: string, data?: any): void {
    const notification: NotificationData = {
      type: 'notification',
      data: {
        title,
        message,
        ...data
      },
      timestamp: Date.now()
    };

    this.broadcast(notification);
    console.log(`🔔 Notificación enviada: ${title}`);
  }

  /**
   * Envía mensaje a un cliente específico
   */
  private sendToClient(clientId: string, data: NotificationData): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(data));
      } catch (error) {
        console.error(`Error enviando a cliente ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Envía mensaje a todos los clientes conectados
   */
  private broadcast(data: NotificationData): void {
    const deadClients: string[] = [];

    this.clients.forEach((client, clientId) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify(data));
        } catch (error) {
          console.error(`Error enviando broadcast a ${clientId}:`, error);
          deadClients.push(clientId);
        }
      } else {
        deadClients.push(clientId);
      }
    });

    // Limpiar clientes desconectados
    deadClients.forEach(clientId => this.clients.delete(clientId));
  }

  /**
   * Inicia el sistema de ping para mantener conexiones vivas
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const deadClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        if (client.socket.readyState === WebSocket.OPEN) {
          if (client.isAlive === false) {
            deadClients.push(clientId);
            return;
          }

          client.isAlive = false;
          client.socket.ping();
        } else {
          deadClients.push(clientId);
        }
      });

      deadClients.forEach(clientId => {
        console.log(`🔔 Cliente inactivo removido: ${clientId}`);
        this.clients.delete(clientId);
      });
    }, 30000); // Ping cada 30 segundos
  }

  /**
   * Genera ID único para cliente
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats(): any {
    return {
      connectedClients: this.clients.size,
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        userId: client.userId,
        isAlive: client.isAlive,
        lastPing: client.lastPing
      }))
    };
  }

  /**
   * Cierra el servicio y todas las conexiones
   */
  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.socket.close();
    });

    if (this.wss) {
      this.wss.close();
    }

    console.log('🔔 Servicio de notificaciones WebSocket cerrado');
  }
}

// Instancia singleton del servicio
export const notificationService = new NotificationWebSocketService();