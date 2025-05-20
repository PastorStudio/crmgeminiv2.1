import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Tipos de eventos/notificaciones que podemos recibir del WebSocket
export enum NotificationType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  MESSAGE_STATUS_CHANGE = 'MESSAGE_STATUS_CHANGE',
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  CAMPAIGN_STATUS = 'CAMPAIGN_STATUS',
  USER_ACTION = 'USER_ACTION',
  SYSTEM_ALERT = 'SYSTEM_ALERT'
}

// Interfaz para una notificación
export interface Notification {
  id: string;
  type: NotificationType;
  timestamp: Date;
  data: any;
}

// Opciones para la configuración del WebSocket
interface WebSocketOptions {
  // Función de callback para cuando llega una notificación
  onNotification?: (notification: Notification) => void;
  // Función de callback para cuando se conecta el WebSocket
  onConnect?: () => void;
  // Función de callback para cuando se desconecta el WebSocket
  onDisconnect?: () => void;
  // Función de callback para cuando hay un error
  onError?: (error: Event) => void;
}

/**
 * Hook para gestionar la conexión WebSocket
 */
export function useWebSocket(options: WebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<Notification | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  // Función para conectar el WebSocket
  const connect = () => {
    // Si ya hay una conexión, no hacer nada
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket ya está conectado');
      return;
    }

    // Determinar el protocolo (ws o wss) basado en si estamos en HTTPS o HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Conectando a WebSocket en:', wsUrl);
    
    try {
      const socket = new WebSocket(wsUrl);

      // Guardar referencia al socket
      socketRef.current = socket;

      // Evento de conexión
      socket.addEventListener('open', () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        setConnectionAttempts(0);
        if (options.onConnect) options.onConnect();
      });

      // Evento de mensaje
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Verificar si es una notificación o un mensaje directo
          if (data.type === 'NOTIFICATION') {
            // Es una notificación del servicio de notificaciones
            const notification = data.data as Notification;
            setLastMessage(notification);
            console.log('Notificación recibida:', notification);
            
            // Procesar notificación según su tipo
            processNotification(notification);
            
            // Llamar al callback si existe
            if (options.onNotification) options.onNotification(notification);
          } else {
            // Es un mensaje genérico
            console.log('Mensaje WebSocket recibido:', data);
          }
        } catch (error) {
          console.error('Error procesando mensaje WebSocket:', error);
        }
      });

      // Evento de cierre
      socket.addEventListener('close', () => {
        console.log('WebSocket cerrado');
        setIsConnected(false);
        if (options.onDisconnect) options.onDisconnect();
        
        // Reconectar después de un tiempo (con backoff exponencial)
        const reconnectDelay = Math.min(1000 * (2 ** connectionAttempts), 30000);
        setConnectionAttempts(prev => prev + 1);
        
        console.log(`Reconectando en ${reconnectDelay}ms (intento ${connectionAttempts + 1})`);
        setTimeout(() => {
          connect();
        }, reconnectDelay);
      });

      // Evento de error
      socket.addEventListener('error', (error) => {
        console.error('Error de WebSocket:', error);
        if (options.onError) options.onError(error);
      });
    } catch (error) {
      console.error('Error creando conexión WebSocket:', error);
    }
  };

  // Procesar notificación según su tipo
  const processNotification = (notification: Notification) => {
    switch (notification.type) {
      case NotificationType.NEW_MESSAGE:
        // Invalidar consultas relacionadas con mensajes
        if (notification.data.chatId) {
          console.log('Invalidando consultas de mensajes debido a nueva notificación');
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages-direct', notification.data.chatId] });
          queryClient.invalidateQueries({ queryKey: ['whatsapp-chats-direct'] });
        }
        break;
      
      case NotificationType.MESSAGE_STATUS_CHANGE:
        // Invalidar consultas de mensajes si hay cambio de estado
        if (notification.data.chatId) {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages-direct', notification.data.chatId] });
        }
        break;
      
      case NotificationType.CONNECTION_STATUS:
        // Invalidar consulta de estado de WhatsApp
        queryClient.invalidateQueries({ queryKey: ['whatsapp-status-direct'] });
        break;
      
      default:
        break;
    }
  };

  // Desconectar WebSocket
  const disconnect = () => {
    if (socketRef.current) {
      console.log('Cerrando conexión WebSocket');
      socketRef.current.close();
      socketRef.current = null;
      setIsConnected(false);
    }
  };

  // Conectar al montar el componente y desconectar al desmontarlo
  useEffect(() => {
    connect();
    
    // Limpiar al desmontar
    return () => {
      disconnect();
    };
  }, []);

  // Función para enviar un mensaje a través de WebSocket
  const sendMessage = (message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      console.log('Enviando mensaje por WebSocket:', messageStr);
      socketRef.current.send(messageStr);
      return true;
    } else {
      console.error('WebSocket no está conectado, no se puede enviar el mensaje');
      return false;
    }
  };

  // Retornar estado y funciones
  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    connectionStatus: isConnected ? 'Connected' : 'Disconnected'
  };
}