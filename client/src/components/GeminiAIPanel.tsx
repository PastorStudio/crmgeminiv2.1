import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Zap, Target, TrendingUp, FileText, Activity, Ticket, KanbanSquare, Loader2, Clock, AlertTriangle, Trash2, Wifi, WifiOff, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";

interface LeadAnalysis {
  priority: 'high' | 'medium' | 'low';
  score: number;
  category: string;
  nextAction: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  conversionProbability: number;
  reasoning: string;
  suggestedFollowUp: string;
  timeline: string;
}

interface AutomationResult {
  success: boolean;
  leadsOrganized: number;
  ticketsProcessed: number;
  kanbanOrganized: number;
  summary: string[];
}

interface ChatConversionResult {
  processed: number;
  created: number;
  updated: number;
  analyzed: number;
}

export function GeminiAIPanel() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState("");
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [automationResult, setAutomationResult] = useState<AutomationResult | null>(null);
  const [chatConversionResult, setChatConversionResult] = useState<ChatConversionResult | null>(null);
  const [organizeResult, setOrganizeResult] = useState<any>(null);
  const [smartReport, setSmartReport] = useState<string>("");
  const [systemResetResult, setSystemResetResult] = useState<any>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<boolean | null>(null);
  
  const { toast } = useToast();
  const { status: whatsappConnected } = useWhatsAppStatus();

  // Check Gemini API key status on component mount
  useEffect(() => {
    checkGeminiKeyStatus();
  }, []);

  // Timer for quota cooldown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsQuotaExceeded(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeRemaining]);

  const checkGeminiKeyStatus = async () => {
    try {
      const response = await fetch('/api/settings/gemini-key-status');
      const data = await response.json();
      setGeminiKeyStatus(data.hasValidKey || false);
    } catch (error) {
      console.error('Error checking Gemini key status:', error);
      setGeminiKeyStatus(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleQuotaError = () => {
    setIsQuotaExceeded(true);
    setTimeRemaining(300); // 5 minutes cooldown
    toast({
      title: "Cuota API excedida",
      description: "Esperando 5 minutos antes del próximo intento",
      variant: "destructive",
    });
  };

  const handleResetClick = () => {
    setShowResetDialog(true);
  };

  const runFullAutomation = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Iniciando automatización completa...");
    setProgress(5);
    
    try {
      // Check if Gemini API is available
      if (!geminiKeyStatus) {
        toast({
          title: "Configuración requerida",
          description: "Se requiere configurar la clave API de Gemini para continuar",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      setCurrentTask("Ejecutando automatización de leads y tickets...");
      setProgress(30);
      
      const response = await fetch('/api/ai/full-automation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
      });
      
      setProgress(70);
      setCurrentTask("Procesando resultados de automatización...");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setAutomationResult(data);
        setProgress(100);
        setCurrentTask("Automatización completada exitosamente");
        
        toast({
          title: "Automatización completa",
          description: "Sistema automatizado exitosamente",
        });
      } else {
        throw new Error(data.error || 'Error en automatización completa');
      }
    } catch (error: any) {
      console.error('Error en automatización:', error);
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        handleQuotaError();
      } else {
        toast({
          title: "Error",
          description: "Error en automatización completa del sistema",
          variant: "destructive",
        });
      }
    }
    setIsProcessing(false);
  };

  const convertChatsToLeads = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Obteniendo chats de WhatsApp...");
    setProgress(10);
    
    try {
      if (!geminiKeyStatus) {
        toast({
          title: "Configuración requerida",
          description: "Se requiere configurar la clave API de Gemini para el análisis con IA",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      setCurrentTask("Convirtiendo chats a leads...");
      setProgress(30);
      
      const response = await fetch('/api/ai/convert-chats-to-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      setProgress(70);
      setCurrentTask("Analizando leads con IA...");
      
      const data = await response.json();
      
      if (data.success) {
        setChatConversionResult(data.data);
        setProgress(100);
        
        toast({
          title: "Conversión completada",
          description: `${data.data.created} nuevos leads creados, ${data.data.analyzed} analizados con IA`,
        });
      } else {
        throw new Error(data.error || 'Error convirtiendo chats');
      }
      
    } catch (error: any) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        handleQuotaError();
      } else {
        toast({
          title: "Error",
          description: "Error convirtiendo chats a leads",
          variant: "destructive",
        });
      }
    }
    setIsProcessing(false);
  };

  const analyzeFirstLead = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Obteniendo primer lead...");
    setProgress(20);
    
    try {
      if (!geminiKeyStatus) {
        toast({
          title: "Configuración requerida",
          description: "Se requiere configurar la clave API de Gemini para el análisis",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      setCurrentTask("Analizando lead con IA...");
      setProgress(60);
      
      const response = await fetch('/api/ai/analyze-lead/1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
        setProgress(100);
        
        toast({
          title: "Análisis completado",
          description: "Lead analizado exitosamente con IA",
        });
      } else {
        throw new Error(data.error || 'Error analizando lead');
      }
      
    } catch (error: any) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        handleQuotaError();
      } else {
        toast({
          title: "Error",
          description: "Error analizando lead",
          variant: "destructive",
        });
      }
    }
    setIsProcessing(false);
  };

  const organizeAllLeads = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Organizando todos los leads...");
    setProgress(30);
    
    try {
      if (!geminiKeyStatus) {
        toast({
          title: "Configuración requerida", 
          description: "Se requiere configurar la clave API de Gemini para la organización inteligente",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const response = await fetch('/api/ai/organize-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      setProgress(80);
      const data = await response.json();
      
      if (data.success) {
        setOrganizeResult(data);
        setProgress(100);
        
        toast({
          title: "Organización completada",
          description: `${data.organized} leads organizados exitosamente`,
        });
      } else {
        throw new Error(data.error || 'Error organizando leads');
      }
      
    } catch (error: any) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        handleQuotaError();
      } else {
        toast({
          title: "Error",
          description: "Error organizando leads",
          variant: "destructive",
        });
      }
    }
    setIsProcessing(false);
  };

  const manageTickets = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Gestionando tickets...");
    setProgress(40);
    
    try {
      const response = await fetch('/api/ai/manage-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProgress(100);
        toast({
          title: "Tickets gestionados",
          description: `${data.processed} tickets procesados exitosamente`,
        });
      } else {
        throw new Error(data.error || 'Error gestionando tickets');
      }
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error gestionando tickets",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const organizeKanban = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Organizando tablero Kanban...");
    setProgress(50);
    
    try {
      const response = await fetch('/api/ai/organize-kanban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProgress(100);
        toast({
          title: "Kanban organizado",
          description: `${data.organized} tarjetas organizadas exitosamente`,
        });
      } else {
        throw new Error(data.error || 'Error organizando Kanban');
      }
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error organizando Kanban",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const generateSmartReport = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Generando reporte inteligente...");
    setProgress(40);
    
    try {
      if (!geminiKeyStatus) {
        toast({
          title: "Configuración requerida",
          description: "Se requiere configurar la clave API de Gemini para generar reportes inteligentes",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const response = await fetch('/api/ai/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSmartReport(data.report);
        setProgress(100);
        
        toast({
          title: "Reporte generado",
          description: "Reporte inteligente generado exitosamente",
        });
      } else {
        throw new Error(data.error || 'Error generando reporte');
      }
      
    } catch (error: any) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        handleQuotaError();
      } else {
        toast({
          title: "Error",
          description: "Error generando reporte",
          variant: "destructive",
        });
      }
    }
    setIsProcessing(false);
  };

  const resetSystemData = async () => {
    if (isQuotaExceeded) return;
    
    setIsProcessing(true);
    setCurrentTask("Eliminando todos los datos del sistema...");
    setProgress(10);
    
    try {
      const response = await fetch('/api/system/reset-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword })
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const data = await response.json();
      
      if (data.success) {
        setSystemResetResult(data);
        setProgress(100);
        setShowResetDialog(false);
        setAdminPassword("");
        
        toast({
          title: "Reset completado",
          description: "Todos los datos del sistema han sido eliminados",
        });
      } else {
        throw new Error(data.error || 'Error en reset del sistema');
      }
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error eliminando datos del sistema",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 hover:bg-red-600';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'low': return 'bg-green-500 hover:bg-green-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-500 hover:bg-green-600';
      case 'neutral': return 'bg-gray-500 hover:bg-gray-600';
      case 'negative': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-purple-600" />
              <span>Panel de Automatización con IA</span>
            </div>
            <div className="flex items-center gap-2">
              {geminiKeyStatus === null ? (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Verificando Gemini...
                </Badge>
              ) : geminiKeyStatus ? (
                <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Gemini AI Listo
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Gemini No Configurado
                </Badge>
              )}
              
              {whatsappConnected === null ? (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Verificando...
                </Badge>
              ) : whatsappConnected ? (
                <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
                  <Wifi className="h-3 w-3 mr-1" />
                  WhatsApp Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <WifiOff className="h-3 w-3 mr-1" />
                  WhatsApp Desconectado
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Organización inteligente de leads, tickets y pipeline de ventas con Gemini AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress and status bar */}
          {(isProcessing || isQuotaExceeded) && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isQuotaExceeded ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-700">
                        Cuota de Gemini AI excedida
                      </span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-sm font-medium text-blue-700">
                        {currentTask || "Procesando..."}
                      </span>
                    </>
                  )}
                </div>
                {timeRemaining > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Próximo intento en: {formatTime(timeRemaining)}</span>
                  </div>
                )}
              </div>
              
              {isProcessing && !isQuotaExceeded && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <div className="text-xs text-gray-500 text-center">
                    {progress}% completado
                  </div>
                </div>
              )}
              
              {isQuotaExceeded && (
                <div className="space-y-2">
                  <Progress value={Math.max(0, 100 - (timeRemaining / 60 * 100))} className="h-2 bg-orange-100" />
                  <div className="text-xs text-orange-600 text-center">
                    Esperando para restablecer cuota de API...
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              onClick={convertChatsToLeads}
              disabled={isProcessing || !geminiKeyStatus}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Activity className="h-4 w-4" />
              {isProcessing ? "Convirtiendo..." : "Chats → Leads con IA"}
            </Button>

            <Button
              onClick={analyzeFirstLead}
              disabled={isProcessing || !geminiKeyStatus}
              className="flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              {isProcessing ? "Analizando..." : "Analizar Lead #1"}
            </Button>
            
            <Button
              onClick={organizeAllLeads}
              disabled={isProcessing || !geminiKeyStatus}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {isProcessing ? "Organizando..." : "Organizar Leads"}
            </Button>
            
            <Button
              onClick={manageTickets}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Ticket className="h-4 w-4" />
              {isProcessing ? "Procesando..." : "Gestionar Tickets"}
            </Button>
            
            <Button
              onClick={organizeKanban}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <KanbanSquare className="h-4 w-4" />
              {isProcessing ? "Organizando..." : "Organizar Kanban"}
            </Button>
            
            <Button
              onClick={generateSmartReport}
              disabled={isProcessing || !geminiKeyStatus}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {isProcessing ? "Generando..." : "Reporte Inteligente"}
            </Button>
            
            <Button
              onClick={runFullAutomation}
              disabled={isProcessing || !geminiKeyStatus}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold col-span-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ejecutando Automatización...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  AUTOMATIZACIÓN COMPLETA DEL SISTEMA
                </>
              )}
            </Button>

            <Button
              onClick={handleResetClick}
              disabled={isProcessing}
              variant="destructive"
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold col-span-full"
            >
              <Trash2 className="h-4 w-4" />
              {isProcessing ? "Eliminando..." : "RESET TOTAL DEL SISTEMA"}
            </Button>
          </div>

          {/* Reset confirmation dialog */}
          <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  Reset Total del Sistema
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  Esta acción eliminará TODOS los datos del sistema de forma permanente:
                  <br />• Todos los leads y contactos
                  <br />• Todos los tickets y actividades
                  <br />• Todos los mensajes y conversaciones
                  <br />• Todos los reportes y análisis
                  <br /><br />
                  <span className="font-semibold text-red-600">⚠️ Esta acción NO se puede deshacer</span>
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="admin-password" className="text-right font-semibold">
                    Clave Admin:
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Ingresa la clave de administrador"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowResetDialog(false);
                    setAdminPassword("");
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={resetSystemData}
                  disabled={!adminPassword || isProcessing}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Confirmar Reset
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Results display */}
          {analysis && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Análisis del Lead</span>
                  <Badge className={getPriorityColor(analysis.priority)}>
                    {analysis.priority.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{analysis.score}/100</div>
                    <div className="text-sm text-gray-600">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{analysis.conversionProbability}%</div>
                    <div className="text-sm text-gray-600">Conversión</div>
                  </div>
                  <div className="text-center">
                    <Badge className={getSentimentColor(analysis.sentiment)}>
                      {analysis.sentiment}
                    </Badge>
                    <div className="text-sm text-gray-600 mt-1">Sentimiento</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium">{analysis.category}</div>
                    <div className="text-sm text-gray-600">Categoría</div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Siguiente Acción:</h4>
                    <p className="text-sm">{analysis.nextAction}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Seguimiento Sugerido:</h4>
                    <p className="text-sm">{analysis.suggestedFollowUp}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Timeline:</h4>
                    <p className="text-sm">{analysis.timeline}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm text-gray-700">Razonamiento de IA:</h4>
                    <p className="text-sm text-gray-600">{analysis.reasoning}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {automationResult && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Resultado de Automatización Completa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{automationResult.leadsOrganized}</div>
                    <div className="text-sm text-blue-700">Leads Organizados</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{automationResult.ticketsProcessed}</div>
                    <div className="text-sm text-green-700">Tickets Procesados</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{automationResult.kanbanOrganized}</div>
                    <div className="text-sm text-purple-700">Kanban Organizado</div>
                  </div>
                </div>
                
                {automationResult.summary && automationResult.summary.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Resumen de automatización:</h4>
                    <ul className="space-y-1">
                      {automationResult.summary.map((item: string, index: number) => (
                        <li key={index} className="text-sm text-gray-600">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {chatConversionResult && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Conversión de Chats de WhatsApp
                </CardTitle>
                <CardDescription>
                  Resultados de la conversión automática de chats en leads analizados con IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{chatConversionResult.processed}</div>
                    <div className="text-sm text-blue-700">Chats Procesados</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{chatConversionResult.created}</div>
                    <div className="text-sm text-green-700">Leads Creados</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{chatConversionResult.updated}</div>
                    <div className="text-sm text-yellow-700">Leads Actualizados</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{chatConversionResult.analyzed}</div>
                    <div className="text-sm text-purple-700">Analizados con IA</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {organizeResult && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Resultado de Organización
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-green-600">{organizeResult.organized}</span>
                    <span className="text-sm text-gray-600">leads organizados exitosamente</span>
                  </div>
                  
                  {organizeResult.insights && organizeResult.insights.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Insights generados:</h4>
                      <ul className="space-y-1">
                        {organizeResult.insights.slice(0, 3).map((insight: string, index: number) => (
                          <li key={index} className="text-sm text-gray-600">• {insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {systemResetResult && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  Reset Total del Sistema Completado
                </CardTitle>
                <CardDescription>
                  Todos los datos del sistema han sido eliminados exitosamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{systemResetResult.deletedLeads}</div>
                    <div className="text-sm text-red-700">Leads Eliminados</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{systemResetResult.deletedTickets}</div>
                    <div className="text-sm text-orange-700">Tickets Eliminados</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{systemResetResult.deletedActivities}</div>
                    <div className="text-sm text-yellow-700">Actividades Eliminadas</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{systemResetResult.deletedMessages}</div>
                    <div className="text-sm text-gray-700">Mensajes Eliminados</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {smartReport && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Reporte Inteligente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm">{smartReport}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}