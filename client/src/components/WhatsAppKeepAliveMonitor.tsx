import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Activity, Wifi, WifiOff, Clock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface KeepAliveStatus {
  isRunning: boolean;
  totalConnections: number;
  activeConnections: number;
  connections: Array<{
    accountId: number;
    lastActivity: string;
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
    failureCount: number;
    lastPing: string;
    sessionAge: number;
  }>;
  intervals: {
    lightPing: number;
    deepPing: number;
    sessionMonitor: number;
  };
}

interface PingStatus {
  accountId: number;
  accountName: string;
  pingStatus: {
    isActive: boolean;
    lastPing: number;
    pingCount: number;
    nextPing: number;
    timeSinceLastPing?: number;
    timeToNextPing?: number;
  };
}

export function WhatsAppKeepAliveMonitor() {
  const [keepAliveStatus, setKeepAliveStatus] = useState<KeepAliveStatus | null>(null);
  const [pingStatuses, setPingStatuses] = useState<PingStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchKeepAliveStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/keepalive-status');
      const data = await response.json();
      if (data.success) {
        setKeepAliveStatus(data.keepAliveSystem);
      }
    } catch (error) {
      console.error('Error fetching keep-alive status:', error);
    }
  };

  const fetchPingStatuses = async () => {
    try {
      const response = await fetch('/api/whatsapp/ping-status/all');
      const data = await response.json();
      if (data.success) {
        setPingStatuses(data.accounts);
      }
    } catch (error) {
      console.error('Error fetching ping statuses:', error);
    }
  };

  const restartKeepAlive = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/whatsapp/keepalive-restart', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sistema KeepAlive reiniciado",
          description: "El sistema de mantenimiento de conexiones se ha reiniciado correctamente.",
        });
        await fetchKeepAliveStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error al reiniciar",
        description: "No se pudo reiniciar el sistema KeepAlive.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startKeepAlive = async (accountId: number) => {
    try {
      const response = await fetch(`/api/whatsapp/${accountId}/start-keepalive`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "KeepAlive activado",
          description: `Mantenimiento de conexión activado para cuenta ${accountId}.`,
        });
        await fetchPingStatuses();
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo activar el keep-alive.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al activar el keep-alive.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  useEffect(() => {
    fetchKeepAliveStatus();
    fetchPingStatuses();
    
    const interval = setInterval(() => {
      fetchKeepAliveStatus();
      fetchPingStatuses();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monitor de Conexiones WhatsApp</h2>
          <p className="text-muted-foreground">
            Sistema avanzado de mantenimiento de conexiones activas
          </p>
        </div>
        <Button
          onClick={restartKeepAlive}
          disabled={isLoading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Reiniciar Sistema
        </Button>
      </div>

      {/* Sistema Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Estado del Sistema KeepAlive
          </CardTitle>
          <CardDescription>
            Monitor principal del sistema de mantenimiento de conexiones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keepAliveStatus ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant={keepAliveStatus.isRunning ? "default" : "destructive"}>
                  {keepAliveStatus.isRunning ? "ACTIVO" : "INACTIVO"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {keepAliveStatus.totalConnections} conexiones registradas
                </span>
                <span className="text-sm text-muted-foreground">
                  {keepAliveStatus.activeConnections} activas
                </span>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Ping Ligero</span>
                  </div>
                  <p className="text-2xl font-bold">{keepAliveStatus.intervals.lightPing}s</p>
                  <p className="text-xs text-muted-foreground">Verificación básica</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Ping Profundo</span>
                  </div>
                  <p className="text-2xl font-bold">{keepAliveStatus.intervals.deepPing}s</p>
                  <p className="text-xs text-muted-foreground">Mantenimiento avanzado</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Monitor Sesiones</span>
                  </div>
                  <p className="text-2xl font-bold">{keepAliveStatus.intervals.sessionMonitor}s</p>
                  <p className="text-xs text-muted-foreground">Gestión de sesiones</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Cargando estado del sistema...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cuentas Individuales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Estado de Cuentas WhatsApp
          </CardTitle>
          <CardDescription>
            Monitor individual de conexiones y ping por cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pingStatuses.length > 0 ? (
            <div className="space-y-4">
              {pingStatuses.map((status) => (
                <div key={status.accountId} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {status.pingStatus.isActive ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">
                          {status.accountName} (ID: {status.accountId})
                        </span>
                      </div>
                      <Badge variant={status.pingStatus.isActive ? "default" : "secondary"}>
                        {status.pingStatus.isActive ? "ACTIVO" : "INACTIVO"}
                      </Badge>
                    </div>
                    
                    {!status.pingStatus.isActive && (
                      <Button
                        onClick={() => startKeepAlive(status.accountId)}
                        size="sm"
                        variant="outline"
                      >
                        Activar KeepAlive
                      </Button>
                    )}
                  </div>

                  {status.pingStatus.isActive && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Último Ping</p>
                        <p className="font-medium">{formatTime(status.pingStatus.lastPing)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Próximo Ping</p>
                        <p className="font-medium">{formatTime(status.pingStatus.nextPing)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Pings</p>
                        <p className="font-medium">{status.pingStatus.pingCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tiempo Restante</p>
                        <p className="font-medium">
                          {status.pingStatus.timeToNextPing ? 
                            formatDuration(status.pingStatus.timeToNextPing) : 
                            'Calculando...'
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {status.pingStatus.isActive && status.pingStatus.timeToNextPing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progreso hasta próximo ping</span>
                        <span>{Math.round((15000 - status.pingStatus.timeToNextPing) / 150)}%</span>
                      </div>
                      <Progress 
                        value={Math.round((15000 - status.pingStatus.timeToNextPing) / 150)} 
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay cuentas de WhatsApp configuradas
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}