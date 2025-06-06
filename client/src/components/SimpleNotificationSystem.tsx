import React, { useEffect, useState } from 'react';
import { Bell, X, MessageCircle, Phone, User } from 'lucide-react';

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

export default function SimpleNotificationSystem() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('🔔 Sistema de notificaciones conectado');
          setIsConnected(true);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'new_message' && data.message) {
              const notification: NotificationData = {
                id: `notif_${Date.now()}_${Math.random()}`,
                title: `Nuevo mensaje de ${data.message.contactName || 'Cliente'}`,
                message: data.message.body || data.message.content || 'Mensaje recibido',
                timestamp: new Date(),
                chatId: data.message.chatId || data.message.from || '',
                contactName: data.message.contactName || 'Cliente',
                type: 'message',
                read: false
              };
              
              setNotifications(prev => [notification, ...prev.slice(0, 9)]);
              showPopupNotification(notification);
            }
          } catch (error) {
            console.error('Error procesando notificación:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('🔔 Conexión de notificaciones cerrada, reintentando...');
          setIsConnected(false);
          setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
          console.error('Error en WebSocket de notificaciones:', error);
          setIsConnected(false);
        };
        
      } catch (error) {
        console.error('Error conectando WebSocket:', error);
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const showPopupNotification = (notification: NotificationData) => {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.chatId
      });
    }

    // Custom popup
    const popup = document.createElement('div');
    popup.className = 'fixed top-4 right-4 z-[9999] bg-gradient-to-r from-red-600 to-black text-white p-4 rounded-lg shadow-2xl border border-red-500 max-w-sm transform translate-x-full transition-transform duration-300';
    popup.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
            </svg>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">${notification.title}</p>
          <p class="text-xs text-red-100 mt-1 truncate">${notification.message}</p>
        </div>
        <button class="flex-shrink-0 text-red-200 hover:text-white" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(popup);
    
    // Animate in
    setTimeout(() => {
      popup.classList.remove('translate-x-full');
    }, 100);

    // Auto remove
    setTimeout(() => {
      if (popup.parentNode) {
        popup.classList.add('translate-x-full');
        setTimeout(() => popup.remove(), 300);
      }
    }, 5000);
  };

  // Request notification permission
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
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={`p-3 rounded-full shadow-lg transition-all duration-200 ${
            isConnected 
              ? 'bg-gradient-to-r from-red-600 to-black hover:from-red-700 hover:to-gray-900' 
              : 'bg-gray-500'
          } text-white hover:scale-105`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Connection indicator */}
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`} />
      </div>

      {/* Notification Panel */}
      {showPanel && (
        <div className="absolute top-14 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-red-600 to-black text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notificaciones</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="text-red-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        {notification.type === 'message' && <MessageCircle className="w-4 h-4 text-red-600" />}
                        {notification.type === 'call' && <Phone className="w-4 h-4 text-red-600" />}
                        {notification.type === 'status' && <User className="w-4 h-4 text-red-600" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex space-x-1">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Marcar leído
                        </button>
                      )}
                      <button
                        onClick={() => clearNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}