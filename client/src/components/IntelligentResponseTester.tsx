import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bot, MessageSquare, TrendingUp } from 'lucide-react';

interface AIResponse {
  message: string;
  confidence: number;
  provider: string;
  reasoning?: string;
}

interface MessageAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: 'inquiry' | 'complaint' | 'interest' | 'objection' | 'ready_to_buy';
  urgency: 'low' | 'medium' | 'high';
}

export const IntelligentResponseTester: React.FC = () => {
  const [chatId, setChatId] = useState('test-chat-' + Date.now());
  const [accountId, setAccountId] = useState('1');
  const [userMessage, setUserMessage] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [analysis, setAnalysis] = useState<MessageAnalysis | null>(null);
  
  const { toast } = useToast();

  const handleGenerateResponse = async () => {
    if (!userMessage.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un mensaje del cliente",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/intelligent-response/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          accountId,
          userMessage,
          customerName: customerName || undefined,
          customerLocation: customerLocation || undefined
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setResponse(data.response);
        toast({
          title: "Respuesta generada",
          description: `Respuesta creada con ${data.response.provider} (confianza: ${Math.round(data.response.confidence * 100)}%)`,
        });
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error generando respuesta:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error al generar respuesta',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeMessage = async () => {
    if (!userMessage.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un mensaje para analizar",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/intelligent-response/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
        toast({
          title: "Análisis completado",
          description: "Mensaje analizado exitosamente",
        });
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error analizando mensaje:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error al analizar mensaje',
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case 'ready_to_buy': return 'bg-green-100 text-green-800';
      case 'interest': return 'bg-blue-100 text-blue-800';
      case 'inquiry': return 'bg-yellow-100 text-yellow-800';
      case 'objection': return 'bg-orange-100 text-orange-800';
      case 'complaint': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Probador de Respuestas Inteligentes
          </CardTitle>
          <CardDescription>
            Prueba el sistema de respuestas AI basado en prompts personalizados y historial de conversación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chatId">ID del Chat</Label>
              <Input
                id="chatId"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Ej: 123456789@c.us"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">ID de Cuenta</Label>
              <Input
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName">Nombre del Cliente (Opcional)</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerLocation">Ubicación del Cliente (Opcional)</Label>
            <Input
              id="customerLocation"
              value={customerLocation}
              onChange={(e) => setCustomerLocation(e.target.value)}
              placeholder="Ej: Ciudad de México, México"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userMessage">Mensaje del Cliente</Label>
            <Textarea
              id="userMessage"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Escribe aquí el mensaje que enviaría un cliente potencial..."
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleGenerateResponse}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              Generar Respuesta
            </Button>

            <Button 
              onClick={handleAnalyzeMessage}
              disabled={isAnalyzing}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              Analizar Mensaje
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Análisis del Mensaje</CardTitle>
            <CardDescription>
              Interpretación automática del sentimiento, intención y urgencia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Badge className={getSentimentColor(analysis.sentiment)}>
                Sentimiento: {analysis.sentiment}
              </Badge>
              <Badge className={getIntentColor(analysis.intent)}>
                Intención: {analysis.intent}
              </Badge>
              <Badge className={getUrgencyColor(analysis.urgency)}>
                Urgencia: {analysis.urgency}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {response && (
        <Card>
          <CardHeader>
            <CardTitle>Respuesta Generada</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Badge variant="outline">{response.provider}</Badge>
              <span>Confianza: {Math.round(response.confidence * 100)}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="whitespace-pre-wrap">{response.message}</p>
              </div>
              
              {response.reasoning && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium">Razonamiento:</Label>
                    <p className="text-sm text-muted-foreground mt-1">{response.reasoning}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};