import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { MessagingIcon, SendIcon, BrainIcon, RefreshIcon, SparklesIcon } from 'lucide-react';

interface GeminiAssistantProps {
  leadId?: number;
  onMessageGenerated?: (message: string) => void;
}

export function GeminiAssistant({ leadId, onMessageGenerated }: GeminiAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('follow-up');
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [leadAnalysis, setLeadAnalysis] = useState<string>('');
  const { toast } = useToast();

  const messageTypes = [
    { id: 'follow-up', label: 'Seguimiento' },
    { id: 'welcome', label: 'Bienvenida' },
    { id: 'proposal', label: 'Propuesta' },
    { id: 'meeting', label: 'Reunión' },
    { id: 'custom', label: 'Personalizado' }
  ];

  const handleGenerateMessage = async () => {
    if (!leadId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un lead primero",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest<{success: boolean, message: string}>({
        url: "/api/gemini/generate-message",
        method: "POST",
        data: {
          leadId,
          messageType: selectedAction
        }
      });

      if (response.success) {
        setGeneratedMessage(response.message);
        toast({
          title: "Mensaje generado",
          description: "Se ha generado un mensaje con IA",
        });
      } else {
        throw new Error("Error al generar mensaje");
      }
    } catch (error) {
      console.error("Error generando mensaje:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el mensaje. Intenta de nuevo más tarde.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeLead = async () => {
    if (!leadId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un lead primero",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest<{success: boolean, analysis: string}>({
        url: "/api/gemini/analyze-lead",
        method: "POST",
        data: { leadId }
      });

      if (response.success) {
        setLeadAnalysis(response.analysis);
        toast({
          title: "Análisis completado",
          description: "Se ha realizado el análisis del lead con IA",
        });
      } else {
        throw new Error("Error al analizar lead");
      }
    } catch (error) {
      console.error("Error analizando lead:", error);
      toast({
        title: "Error",
        description: "No se pudo analizar el lead. Intenta de nuevo más tarde.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseMessage = () => {
    if (onMessageGenerated && generatedMessage) {
      onMessageGenerated(generatedMessage);
      toast({
        title: "Mensaje insertado",
        description: "Se ha insertado el mensaje en el área de texto",
      });
    }
  };

  return (
    <Card className="w-full border-teal-500/20 shadow-md">
      <CardHeader className="bg-gradient-to-r from-teal-500/10 to-transparent">
        <CardTitle className="flex items-center gap-2 text-teal-700">
          <BrainIcon size={20} />
          Asistente Gemini
        </CardTitle>
        <CardDescription>
          Utiliza IA para analizar leads y generar mensajes personalizados
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="generate">
          <TabsList className="w-full">
            <TabsTrigger value="generate" className="flex-1">
              <MessagingIcon size={16} className="mr-2" />
              Generar Mensaje
            </TabsTrigger>
            <TabsTrigger value="analyze" className="flex-1">
              <SparklesIcon size={16} className="mr-2" />
              Analizar Lead
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="generate" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {messageTypes.map(type => (
                <Button
                  key={type.id}
                  variant={selectedAction === type.id ? "default" : "outline"}
                  onClick={() => setSelectedAction(type.id)}
                  className="h-10"
                >
                  {type.label}
                </Button>
              ))}
            </div>

            <div className="mt-4">
              <Button 
                onClick={handleGenerateMessage} 
                disabled={loading || !leadId}
                className="w-full"
              >
                {loading ? <Spinner size="sm" className="mr-2" /> : <RefreshIcon size={16} className="mr-2" />}
                Generar mensaje {selectedAction}
              </Button>
            </div>

            {generatedMessage && (
              <div className="mt-4">
                <Textarea 
                  value={generatedMessage} 
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  className="h-32"
                />
                <Button 
                  onClick={handleUseMessage}
                  className="w-full mt-2"
                  variant="outline"
                >
                  <SendIcon size={16} className="mr-2" />
                  Usar este mensaje
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="analyze" className="mt-4">
            <Button 
              onClick={handleAnalyzeLead} 
              disabled={loading || !leadId}
              className="w-full mb-4"
            >
              {loading ? <Spinner size="sm" className="mr-2" /> : <SparklesIcon size={16} className="mr-2" />}
              Analizar lead con IA
            </Button>

            {leadAnalysis ? (
              <div className="border rounded-md p-4 bg-teal-50/50 max-h-[300px] overflow-y-auto">
                <div className="whitespace-pre-wrap">{leadAnalysis}</div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Haz clic en "Analizar lead" para obtener información valiosa basada en IA
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="bg-gradient-to-r from-transparent to-teal-500/10 text-xs text-gray-500 italic justify-end">
        Potenciado por Google Gemini AI
      </CardFooter>
    </Card>
  );
}