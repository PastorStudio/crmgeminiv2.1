import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Ticket, 
  RefreshCw, 
  Search, 
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye
} from 'lucide-react';

const TicketsSimple = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Datos de ejemplo para mostrar la funcionalidad
  const mockStats = {
    byStatus: {
      nuevo: 0,
      interesado: 0,
      no_leido: 0,
      pendiente_demo: 0,
      completado: 0,
      no_interesado: 0
    },
    totals: {
      total: 0,
      active: 0,
      today: 0
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      nuevo: { color: 'bg-blue-500', icon: <AlertCircle className="w-3 h-3" />, label: 'Nuevo' },
      interesado: { color: 'bg-green-500', icon: <Eye className="w-3 h-3" />, label: 'Interesado' },
      no_leido: { color: 'bg-red-500', icon: <MessageSquare className="w-3 h-3" />, label: 'No Leído' },
      pendiente_demo: { color: 'bg-yellow-500', icon: <Clock className="w-3 h-3" />, label: 'Pendiente Demo' },
      completado: { color: 'bg-emerald-500', icon: <CheckCircle className="w-3 h-3" />, label: 'Completado' },
      no_interesado: { color: 'bg-gray-500', icon: <XCircle className="w-3 h-3" />, label: 'No Interesado' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.nuevo;
    
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Sistema de Tickets</h1>
          <p className="text-muted-foreground">
            Gestión automática de conversaciones de WhatsApp
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totals.total}</div>
            <p className="text-xs text-muted-foreground">Total acumulado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tickets Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{mockStats.totals.active}</div>
            <p className="text-xs text-muted-foreground">Pendientes de atención</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mockStats.totals.today}</div>
            <p className="text-xs text-muted-foreground">Tickets creados hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">No Leídos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mockStats.byStatus.no_leido}</div>
            <p className="text-xs text-muted-foreground">Requieren atención inmediata</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por cliente, teléfono o mensaje..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Tabs por categorías de tickets */}
      <Tabs defaultValue="nuevo" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="nuevo" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Nuevos ({mockStats.byStatus.nuevo})
          </TabsTrigger>
          <TabsTrigger value="interesado" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Interesados ({mockStats.byStatus.interesado})
          </TabsTrigger>
          <TabsTrigger value="no_leido" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            No Leídos ({mockStats.byStatus.no_leido})
          </TabsTrigger>
          <TabsTrigger value="pendiente_demo" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pendiente Demo ({mockStats.byStatus.pendiente_demo})
          </TabsTrigger>
          <TabsTrigger value="completado" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Completados ({mockStats.byStatus.completado})
          </TabsTrigger>
          <TabsTrigger value="no_interesado" className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            No Interesados ({mockStats.byStatus.no_interesado})
          </TabsTrigger>
        </TabsList>

        {/* Contenido de cada tab */}
        {(['nuevo', 'interesado', 'no_leido', 'pendiente_demo', 'completado', 'no_interesado'] as const).map((status) => (
          <TabsContent key={status} value={status}>
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Ticket className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sistema de Tickets Configurado</h3>
              <p className="text-muted-foreground mb-4">
                El sistema está listo para convertir conversaciones de WhatsApp en tickets automáticamente.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-medium text-blue-900 mb-2">Características del Sistema:</h4>
                <ul className="text-sm text-blue-800 space-y-1 text-left">
                  <li>• Categorización automática de mensajes</li>
                  <li>• Asignación inteligente a agentes</li>
                  <li>• Seguimiento de métricas de rendimiento</li>
                  <li>• Priorización basada en contenido</li>
                  <li>• Filtros avanzados y búsqueda</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default TicketsSimple;