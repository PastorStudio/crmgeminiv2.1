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

export function useNotifications() {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;
      
      console.log('🔔 Conectando a notificaciones:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔔 Conectado al sistema de notificaciones');
        setIsConnected(true);
        
        // Limpiar timeout de reconexión si existe
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const notification: NotificationMessage = JSON.parse(event.data);
          console.log('🔔 Notificación recibida:', notification);
          
          // Agregar a la lista de notificaciones
          setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Mantener últimas 50
          
          // Mostrar toast para notificaciones importantes
          if (notification.type === 'new_message' || notification.urgent) {
            toast({
              title: notification.title,
              description: notification.message,
              duration: 5000,
            });
          }
        } catch (error) {
          console.error('❌ Error procesando notificación:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔔 Conexión de notificaciones cerrada');
        setIsConnected(false);
        
        // Intentar reconectar después de 3 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔔 Reintentando conexión...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('❌ Error en WebSocket de notificaciones:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('❌ Error creando conexión WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const sendTestNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        console.log('✅ Notificación de prueba enviada');
      } else {
        console.error('❌ Error enviando notificación de prueba');
      }
    } catch (error) {
      console.error('❌ Error enviando notificación de prueba:', error);
    }
  }, []);

  const getNotificationStats = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/status');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        return data;
      }
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de notificaciones:', error);
    }
    return null;
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, []);

  // Conectar automáticamente al montar el componente
  useEffect(() => {
    connect();
    
    // Obtener estadísticas cada 30 segundos
    const statsInterval = setInterval(getNotificationStats, 30000);
    
    return () => {
      disconnect();
      clearInterval(statsInterval);
    };
  }, [connect, disconnect, getNotificationStats]);

  return {
    isConnected,
    notifications,
    stats,
    connect,
    disconnect,
    sendTestNotification,
    getNotificationStats,
    clearNotifications,
    markAsRead,
  };
}