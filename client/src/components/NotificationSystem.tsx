import { useState, useEffect, useRef } from 'react';
import { Bell, MessageCircle, X, Phone, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WhatsAppMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  chatId: string;
  contactName?: string;
  isGroup: boolean;
}

interface NotificationData {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  chatId: string;
  contactName: string;
  type: 'message' | 'call' | 'status';
  read: boolean;
}

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Configurar sonido de notificación
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp56hVFApGn+DyvmAaDDuP0fPPfC4HJnXE8OGUQwsXYrPn56pYFAw9mN7+wmQaTUaW0+/TgDMGJnvD7OOXRAkRW7Ll4qhYGAhBn9z9vWIaNj2N0PDP');
    audioRef.current.volume = 0.3;
  }, []);

  // Conectar WebSocket para notificaciones en tiempo real
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('🔔 Sistema de notificaciones conectado');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_message') {
            handleNewMessage(data.message);
          } else if (data.type === 'notification') {
            handleNotification(data);
          }
        } catch (error) {
          console.error('Error procesando notificación:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Error en WebSocket de notificaciones:', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('🔔 Conexión de notificaciones cerrada, reintentando...');
        setIsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleNewMessage = (message: WhatsAppMessage) => {
    // No mostrar notificaciones de mensajes propios
    if (message.fromMe) return;

    const notificationId = `msg_${message.id}_${Date.now()}`;
    
    // Check if notification was already read
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    const isAlreadyRead = readNotifications.includes(notificationId);

    const notification: NotificationData = {
      id: notificationId,
      title: message.contactName || message.from,
      message: message.body.length > 100 ? message.body.substring(0, 100) + '...' : message.body,
      timestamp: new Date(message.timestamp * 1000),
      chatId: message.chatId,
      contactName: message.contactName || message.from,
      type: 'message',
      read: isAlreadyRead
    };

    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Mantener solo 10 notificaciones

    // Reproducir sonido
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('No se pudo reproducir sonido:', e));
    }

    // Mostrar notificación del navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Nuevo mensaje de ${notification.title}`, {
        body: notification.message,
        icon: '/whatsapp-icon.png',
        tag: `msg_${message.chatId}`,
        requireInteraction: false
      });
    }

    // Mostrar notificación emergente temporal
    showPopupNotification(notification);
  };

  const handleNotification = (data: any) => {
    const notification: NotificationData = {
      id: `notif_${Date.now()}`,
      title: data.title || 'Notificación',
      message: data.message || '',
      timestamp: new Date(),
      chatId: data.chatId || '',
      contactName: data.contactName || '',
      type: data.notificationType || 'status',
      read: false
    };

    setNotifications(prev => [notification, ...prev.slice(0, 9)]);
  };

  const showPopupNotification = (notification: NotificationData) => {
    // Crear notificación emergente personalizada
    const popup = document.createElement('div');
    popup.className = 'fixed top-4 right-4 z-50 bg-black border border-red-600 rounded-lg shadow-2xl p-4 w-80 transform transition-all duration-300 translate-x-full';
    popup.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.891 3.585"/>
            </svg>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">${notification.title}</p>
          <p class="text-sm text-gray-300 truncate">${notification.message}</p>
          <p class="text-xs text-gray-400 mt-1">${notification.timestamp.toLocaleTimeString()}</p>
        </div>
        <button class="flex-shrink-0 text-gray-400 hover:text-white" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    // Animar entrada
    setTimeout(() => {
      popup.classList.remove('translate-x-full');
    }, 100);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      popup.classList.add('translate-x-full');
      setTimeout(() => {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
      }, 300);
    }, 5000);
  };

  // Solicitar permisos de notificación
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    
    // Store read notification in localStorage
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    if (!readNotifications.includes(id)) {
      readNotifications.push(id);
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Botón de notificaciones */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative text-white hover:bg-white/10 bg-black/80 border border-red-600"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Estado de conexión */}
      <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />

      {/* Panel de notificaciones */}
      {showNotifications && (
        <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden bg-black border-red-600 z-50">
          <div className="p-3 border-b border-red-600 bg-gradient-to-r from-red-900 to-black">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Notificaciones</h3>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotifications(false)}
                  className="text-white hover:bg-white/10 p-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="p-0 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b border-gray-700 hover:bg-gray-800 cursor-pointer ${
                      !notification.read ? 'bg-red-900/20' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {notification.type === 'message' ? (
                          <MessageCircle className="h-5 w-5 text-green-500" />
                        ) : notification.type === 'call' ? (
                          <Phone className="h-5 w-5 text-blue-500" />
                        ) : (
                          <User className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-300 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          {notifications.length > 0 && (
            <div className="p-2 border-t border-red-600">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllNotifications}
                className="w-full border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
              >
                Limpiar todas
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}