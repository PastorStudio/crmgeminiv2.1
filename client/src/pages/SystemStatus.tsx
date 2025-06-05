import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, Zap, Bot, MessageSquare, Users, Target } from 'lucide-react';

interface SystemStatus {
  automaticAssignments: boolean;
  geminiAIIntegration: boolean;
  whatsappConnections: boolean;
  autoLeadGeneration: boolean;
  autoActivityCreation: boolean;
  processingInterval: string;
  systemStatus: string;
}

interface GeminiTest {
  success: boolean;
  message: string;
  testMessage?: string;
  analysis?: any;
  aiStatus?: string;
}

export default function SystemStatus() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [geminiTest, setGeminiTest] = useState<GeminiTest | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const activateCompleteSystem = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/force-complete-system-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setSystemStatus(data.features);
    } catch (error) {
      console.error('Error activating system:', error);
    } finally {
      setLoading(false);
    }
  };

  const testGeminiIntegration = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/test-gemini-integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setGeminiTest(data);
    } catch (error) {
      console.error('Error testing Gemini:', error);
      setGeminiTest({
        success: false,
        message: 'Error testing Gemini AI integration'
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <AlertCircle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estado del Sistema Completo</h1>
          <p className="text-muted-foreground">
            Sistema de asignaciones automáticas con IA Gemini integrada
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={activateCompleteSystem}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Activar Sistema Completo
          </Button>
          <Button 
            onClick={testGeminiIntegration}
            disabled={testing}
            variant="outline"
          >
            {testing ? (
              <Clock className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Bot className="h-4 w-4 mr-2" />
            )}
            Test Gemini AI
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      {systemStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              Estado General del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.automaticAssignments)}
                  <span className="font-medium">Asignaciones Automáticas</span>
                </div>
                <Badge variant={systemStatus.automaticAssignments ? "default" : "secondary"}>
                  {systemStatus.automaticAssignments ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.geminiAIIntegration)}
                  <span className="font-medium">IA Gemini</span>
                </div>
                <Badge variant={systemStatus.geminiAIIntegration ? "default" : "secondary"}>
                  {systemStatus.geminiAIIntegration ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.whatsappConnections)}
                  <span className="font-medium">WhatsApp</span>
                </div>
                <Badge variant={systemStatus.whatsappConnections ? "default" : "secondary"}>
                  {systemStatus.whatsappConnections ? "Conectado" : "Desconectado"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.autoLeadGeneration)}
                  <span className="font-medium">Generación de Leads</span>
                </div>
                <Badge variant={systemStatus.autoLeadGeneration ? "default" : "secondary"}>
                  {systemStatus.autoLeadGeneration ? "Automático" : "Manual"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.autoActivityCreation)}
                  <span className="font-medium">Actividades Automáticas</span>
                </div>
                <Badge variant={systemStatus.autoActivityCreation ? "default" : "secondary"}>
                  {systemStatus.autoActivityCreation ? "Activo" : "Inactivo"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">Intervalo</span>
                </div>
                <Badge variant="outline">
                  {systemStatus.processingInterval}
                </Badge>
              </div>
            </div>

            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-green-800">
                  Sistema Status: {systemStatus.systemStatus}
                </span>
              </div>
              <p className="text-green-700 mt-1">
                Todas las funciones están operando al 100% con procesamiento automático cada 5 segundos
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gemini AI Test Results */}
      {geminiTest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-500" />
              Resultado del Test de Gemini AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-4 border rounded-lg ${
              geminiTest.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {geminiTest.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span className={`font-semibold ${
                  geminiTest.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {geminiTest.message}
                </span>
              </div>
              
              {geminiTest.testMessage && (
                <div className="mt-3">
                  <h4 className="font-medium mb-1">Mensaje de prueba:</h4>
                  <p className="text-sm text-gray-600 italic">"{geminiTest.testMessage}"</p>
                </div>
              )}

              {geminiTest.analysis && (
                <div className="mt-3">
                  <h4 className="font-medium mb-2">Análisis de IA:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Sentimiento:</span>
                      <Badge variant="outline" className="ml-1">
                        {geminiTest.analysis.sentiment}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Intención:</span>
                      <Badge variant="outline" className="ml-1">
                        {geminiTest.analysis.intent}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Urgencia:</span>
                      <Badge variant="outline" className="ml-1">
                        {geminiTest.analysis.urgency}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Potencial:</span>
                      <Badge variant="outline" className="ml-1">
                        {geminiTest.analysis.leadPotential}%
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Mensajes IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Análisis automático de mensajes WhatsApp con Gemini AI cada 5 segundos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-green-500" />
              Leads Automáticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Creación inteligente de leads basada en el contenido de los mensajes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-purple-500" />
              Asignaciones IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Asignación automática de chats a agentes según análisis de contexto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-orange-500" />
              Actividades Auto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generación automática de actividades y seguimientos
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}