import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Brain, Zap, Target, TrendingUp, FileText, Activity, Ticket, KanbanSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export function GeminiAIPanel() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [organizeResult, setOrganizeResult] = useState<any>(null);
  const [smartReport, setSmartReport] = useState<string | null>(null);
  const [ticketsResult, setTicketsResult] = useState<any>(null);
  const [kanbanResult, setKanbanResult] = useState<any>(null);
  const [automationResult, setAutomationResult] = useState<any>(null);
  const { toast } = useToast();

  const analyzeFirstLead = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/analyze-lead/1');
      const data = await response.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
        toast({
          title: "✅ Análisis completado",
          description: `Lead analizado con score ${data.analysis.score}/100`,
        });
      } else {
        throw new Error(data.error || 'Error en análisis');
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error al analizar lead con Gemini AI",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const organizeAllLeads = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/organize-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      
      if (data.success) {
        setOrganizeResult(data);
        toast({
          title: "🤖 Organización exitosa",
          description: `${data.organized} leads organizados con IA`,
        });
      } else {
        throw new Error(data.error || 'Error en organización');
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error al organizar leads automáticamente",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const generateSmartReport = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/smart-report');
      const data = await response.json();
      
      if (data.success) {
        setSmartReport(data.report);
        toast({
          title: "📊 Reporte generado",
          description: `Analizados ${data.leadsAnalyzed} leads`,
        });
      } else {
        throw new Error(data.error || 'Error en reporte');
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error al generar reporte inteligente",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const manageTickets = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/manage-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      
      if (data.success) {
        setTicketsResult(data);
        toast({
          title: "🎫 Tickets gestionados",
          description: `${data.processed} mensajes procesados, ${data.created} tickets creados`,
        });
      } else {
        throw new Error(data.error || 'Error en gestión de tickets');
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error al gestionar tickets automáticamente",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const organizeKanban = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/kanban-organize');
      const data = await response.json();
      
      if (data.success) {
        setKanbanResult(data);
        toast({
          title: "📋 Kanban organizado",
          description: `${data.organized} tarjetas organizadas en tablero`,
        });
      } else {
        throw new Error(data.error || 'Error en organización Kanban');
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error al organizar tablero Kanban",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const runFullAutomation = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/full-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      
      if (data.success) {
        setAutomationResult(data);
        toast({
          title: "🚀 Automatización completa",
          description: "Sistema automatizado exitosamente",
        });
      } else {
        throw new Error(data.error || 'Error en automatización completa');
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Error en automatización completa del sistema",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'neutral': return 'bg-blue-100 text-blue-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Panel de Gemini AI
          </CardTitle>
          <CardDescription>
            Organización inteligente de leads, tickets y pipeline de ventas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              onClick={analyzeFirstLead}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              {isProcessing ? "Analizando..." : "Analizar Lead #1"}
            </Button>
            
            <Button
              onClick={organizeAllLeads}
              disabled={isProcessing}
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
              disabled={isProcessing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {isProcessing ? "Generando..." : "Reporte Inteligente"}
            </Button>
            
            <Button
              onClick={runFullAutomation}
              disabled={isProcessing}
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
                  🚀 AUTOMATIZACIÓN COMPLETA DEL SISTEMA
                </>
              )}
            </Button>
          </div>

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