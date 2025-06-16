import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, CheckCircle } from "lucide-react";

interface ConversionStats {
  totalAutoLeads: number;
  recentAutoLeads: number;
  conversionActive: boolean;
  lastUpdate: string;
}

export function AutoChatToLeadPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [lastConversion, setLastConversion] = useState<any>(null);

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/auto-convert-chats/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
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
                Sistema automático activo - convierte chats de WhatsApp en leads cada 30 segundos
              </CardDescription>
            </div>
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Activo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado del sistema automático */}
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Sistema Automático Activo</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              La conversión automática de chats a leads está funcionando en segundo plano cada 30 segundos
            </p>
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