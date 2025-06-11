/**
 * Hook para manejar notificaciones en tiempo real
 * Conecta con el sistema de notificaciones WebSocket del servidor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from './use-toast';

export interface NotificationMessage {
  id: string;
  type: 'new_message' | 'status_change' | 'system_alert';
  chatId: string;
  accountId: number;
  title: string;
  message: string;
  timestamp: number;
  urgent?: boolean;
  data?: any;
  read?: boolean;
}

export interface NotificationStats {
  connectedClients: number;
  isActive: boolean;
  lastMessageTimestamps: number;
}

export const useNotifications = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  useEffect(() => {
    const connectWebSocket = () => {
      if (retryCount >= maxRetries) {
        console.log('🔔 Máximo de reintentos alcanzado, deshabilitando notificaciones');
        return;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        const websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          console.log('🔔 Conexión de notificaciones establecida');
          setIsConnected(true);
          setWs(websocket);
          setRetryCount(0); // Reset retry count on successful connection
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'notification') {
              setNotifications(prev => [data.notification, ...prev.slice(0, 49)]);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = () => {
          console.log('🔔 Conexión de notificaciones cerrada');
          setIsConnected(false);
          setWs(null);

          // Only retry if under max retries
          if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setTimeout(connectWebSocket, Math.min(1000 * Math.pow(2, retryCount), 10000));
          }
        };

        websocket.onerror = (error) => {
          console.error('Error en WebSocket de notificaciones:', error);
          setIsConnected(false);
          websocket.close();
        };
      } catch (error) {
        console.error('Error conectando WebSocket:', error);
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          setTimeout(connectWebSocket, Math.min(1000 * Math.pow(2, retryCount), 10000));
        }
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [retryCount]);

  return {
    isConnected,
    notifications,
    clearNotifications: () => setNotifications([])
  };
};