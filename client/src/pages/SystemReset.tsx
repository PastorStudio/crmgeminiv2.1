import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  Users, 
  Trash2,
  Shield,
  Eye,
  EyeOff,
  Crown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SystemStatus {
  users: {
    total: number;
    visible: number;
    hidden: number;
    djpStatus: 'hidden' | 'visible' | 'not_found';
  };
  data: {
    leads: number;
    messages: number;
    activities: number;
    templates: number;
  };
  lastReset?: string;
}

export default function SystemReset() {
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  
  const { toast } = useToast();

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/system/status');
      const data = await response.json();
      
      if (data.success) {
        setSystemStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking system status:', error);
    }
  };

  const executeSystemReset = async () => {
    if (confirmText !== 'RESET SYSTEM') {
      toast({
        title: "Error de confirmación",
        description: "Debes escribir 'RESET SYSTEM' para confirmar",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/system/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sistema reiniciado",
          description: `Sistema reiniciado correctamente. Usuarios preservados: ${data.preserved_users?.join(', ')}`,
        });
        setShowResetDialog(false);
        setConfirmText('');
        checkSystemStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error durante el reinicio del sistema",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const hideDJPUser = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/system/hide-djp', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Usuario DJP oculto",
          description: "Usuario DJP configurado como oculto exitosamente",
        });
        checkSystemStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error configurando usuario DJP",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Database className="h-6 w-6 text-red-600" />
            <span>Reinicio Completo del Sistema</span>
          </CardTitle>
          <CardDescription>
            Administración avanzada del sistema - Solo para superadministradores
          </CardDescription>
        </CardHeader>
      </Card>

      {/* System Status */}
      {systemStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Estado del Sistema</span>
              <Button onClick={checkSystemStatus} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{systemStatus.users.total}</div>
                <div className="text-sm text-blue-700">Usuarios Total</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{systemStatus.users.visible}</div>
                <div className="text-sm text-green-700">Usuarios Visibles</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{systemStatus.users.hidden}</div>
                <div className="text-sm text-purple-700">Usuarios Ocultos</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <Crown className="h-5 w-5 text-orange-600" />
                  <Badge 
                    variant={systemStatus.users.djpStatus === 'hidden' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {systemStatus.users.djpStatus === 'hidden' ? 'Oculto' : 'Visible'}
                  </Badge>
                </div>
                <div className="text-sm text-orange-700 mt-1">Estado DJP</div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold">{systemStatus.data.leads}</div>
                <div className="text-sm text-gray-600">Leads</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{systemStatus.data.messages}</div>
                <div className="text-sm text-gray-600">Mensajes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{systemStatus.data.activities}</div>
                <div className="text-sm text-gray-600">Actividades</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{systemStatus.data.templates}</div>
                <div className="text-sm text-gray-600">Plantillas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DJP User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-purple-600" />
            <span>Gestión Usuario DJP</span>
          </CardTitle>
          <CardDescription>
            El usuario DJP debe permanecer oculto en las interfaces públicas manteniendo acceso completo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-purple-600" />
              <div>
                <div className="font-medium">Usuario DJP (Superadministrador)</div>
                <div className="text-sm text-gray-600">Acceso completo al sistema, oculto de interfaces públicas</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {systemStatus?.users.djpStatus === 'hidden' ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <EyeOff className="h-3 w-3" />
                  Oculto
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Visible
                </Badge>
              )}
            </div>
          </div>
          
          <Button 
            onClick={hideDJPUser}
            disabled={isLoading || systemStatus?.users.djpStatus === 'hidden'}
            className="w-full"
          >
            <EyeOff className="h-4 w-4 mr-2" />
            Configurar DJP como Oculto
          </Button>
        </CardContent>
      </Card>

      {/* System Reset */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span>Reinicio Completo del Sistema</span>
          </CardTitle>
          <CardDescription className="text-red-600">
            Esta acción eliminará TODOS los datos excepto los usuarios DJP y admin. No se puede deshacer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">Se eliminarán:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Todos los leads y contactos</li>
              <li>• Todos los mensajes y conversaciones</li>
              <li>• Todas las actividades (excepto DJP)</li>
              <li>• Todas las cuentas de WhatsApp</li>
              <li>• Todas las plantillas de mensajes</li>
              <li>• Todos los usuarios (excepto DJP y admin)</li>
              <li>• Todas las estadísticas y métricas</li>
            </ul>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">Se preservarán:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Usuario DJP (superadministrador, oculto)</li>
              <li>• Usuario admin (administrador, visible)</li>
              <li>• Configuraciones esenciales del sistema</li>
              <li>• Estructura de la base de datos</li>
            </ul>
          </div>

          <Button 
            onClick={() => setShowResetDialog(true)}
            disabled={isLoading}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Iniciar Reinicio Completo
          </Button>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Reinicio del Sistema
            </DialogTitle>
            <DialogDescription className="text-red-600">
              Esta acción es IRREVERSIBLE. Todos los datos se perderán excepto los usuarios DJP y admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm">
                Escribe <strong>"RESET SYSTEM"</strong> para confirmar:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET SYSTEM"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowResetDialog(false);
                setConfirmText('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={executeSystemReset}
              disabled={isLoading || confirmText !== 'RESET SYSTEM'}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Ejecutar Reinicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}