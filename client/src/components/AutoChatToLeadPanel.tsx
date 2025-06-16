import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, BarChart3, Users, CheckCircle } from "lucide-react";

interface ConversionStats {
  totalAutoLeads: number;
  recentAutoLeads: number;
  conversionActive: boolean;
  lastUpdate: string;
}

export function AutoChatToLeadPanel() {
  const { toast } = useToast();
  const [isActivating, setIsActivating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [lastConversion, setLastConversion] = useState<any>(null);

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/auto-convert-chats/stats');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const activateAutoConversion = async () => {
    setIsActivating(true);
    try {
      const response = await fetch('/api/auto-convert-chats/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setLastConversion(data.data);
        toast({
          title: "Sistema Activado",
          description: `Conversión automática activada. ${data.data?.created || 0} nuevos leads creados.`,
        });
        await loadStats();
      } else {
        toast({
          title: "Error",
          description: data.message || "Error activando el sistema",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error de conexión al activar el sistema",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  const convertNow = async () => {
    setIsConverting(true);
    try {
      const response = await fetch('/api/auto-convert-chats/convert-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setLastConversion(data.data);
        toast({
          title: "Conversión Completada",
          description: `${data.data?.created || 0} nuevos leads creados, ${data.data?.updated || 0} actualizados.`,
        });
        await loadStats();
      } else {
        toast({
          title: "Error",
          description: data.message || "Error en la conversión",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error de conexión durante la conversión",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Panel principal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Conversión Automática: Chats → Leads
              </CardTitle>
              <CardDescription>
                Convierte automáticamente todos los chats de WhatsApp en leads para el pipeline de ventas
              </CardDescription>
            </div>
            {stats?.conversionActive && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Activo
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button 
              onClick={activateAutoConversion}
              disabled={isActivating || isConverting}
              className="flex-1"
            >
              {isActivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Activar Sistema Automático
                </>
              )}
            </Button>
            
            <Button 
              onClick={convertNow}
              disabled={isActivating || isConverting}
              variant="outline"
              className="flex-1"
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Convirtiendo...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Convertir Ahora
                </>
              )}
            </Button>
          </div>

          {/* Estadísticas */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalAutoLeads}</div>
                <div className="text-sm text-gray-600">Total Leads Automáticos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.recentAutoLeads}</div>
                <div className="text-sm text-gray-600">Últimas 24 horas</div>
              </div>
            </div>
          )}

          {/* Resultado de última conversión */}
          {lastConversion && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2">Última Conversión:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">{lastConversion.processed || 0}</span>
                  <div className="text-gray-600">Procesados</div>
                </div>
                <div>
                  <span className="font-medium text-green-600">{lastConversion.created || 0}</span>
                  <div className="text-gray-600">Creados</div>
                </div>
                <div>
                  <span className="font-medium text-blue-600">{lastConversion.updated || 0}</span>
                  <div className="text-gray-600">Actualizados</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información del sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <strong>Monitoreo Automático:</strong> El sistema revisa todos los chats de WhatsApp cada 30 segundos
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <strong>Conversión Inteligente:</strong> Cada chat nuevo se convierte automáticamente en un lead
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <strong>Pipeline de Ventas:</strong> Los leads aparecen inmediatamente en la página de ventas y leads
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <strong>Asignación Automática:</strong> Los leads se asignan automáticamente a agentes disponibles
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}