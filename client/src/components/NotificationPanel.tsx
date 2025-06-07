import React, { useState } from 'react';
import { Bell, X, Check, AlertTriangle, MessageSquare, Settings } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function NotificationPanel() {
  const {
    isConnected,
    notifications,
    stats,
    sendTestNotification,
    clearNotifications,
    markAsRead
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_message':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'status_change':
        return <Settings className="h-4 w-4 text-yellow-500" />;
      case 'system_alert':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string, urgent?: boolean) => {
    if (urgent) return 'border-l-red-500 bg-red-50';
    switch (type) {
      case 'new_message':
        return 'border-l-blue-500 bg-blue-50';
      case 'status_change':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'system_alert':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        <div
          className={`absolute top-0 right-0 h-2 w-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isConnected ? 'Conectado' : 'Desconectado'}
        />
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h3 className="font-semibold">Notificaciones</h3>
              <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
                {isConnected ? 'En línea' : 'Desconectado'}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600">
              Clientes conectados: {stats.connectedClients} | 
              Activo: {stats.isActive ? 'Sí' : 'No'}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 p-3 border-b">
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestNotification}
              className="text-xs"
            >
              Probar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearNotifications}
              className="text-xs"
            >
              Limpiar
            </Button>
          </div>

          {/* Notifications List */}
          <ScrollArea className="max-h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border-l-4 ${getNotificationColor(
                      notification.type,
                      notification.urgent
                    )} ${!notification.read ? 'bg-opacity-100' : 'bg-opacity-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{notification.title}</p>
                            {notification.urgent && (
                              <Badge variant="destructive" className="text-xs">
                                Urgente
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          {notification.chatId && (
                            <p className="text-xs text-gray-500 mt-1">
                              Chat: {notification.chatId.replace('@c.us', '')}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(notification.timestamp), {
                              addSuffix: true,
                              locale: es
                            })}
                          </p>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="ml-2"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
            Sistema de notificaciones en tiempo real
          </div>
        </div>
      )}
    </div>
  );
}