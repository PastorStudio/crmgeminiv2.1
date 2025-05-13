import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGemini } from "@/hooks/useGemini";
import { MessageSquare, Send, Brain, RotateCw, Sparkles } from 'lucide-react';

interface GeminiAssistantProps {
  leadId?: number;
  onMessageGenerated?: (message: string) => void;
}

export function GeminiAssistant({ leadId, onMessageGenerated }: GeminiAssistantProps) {
  const [selectedAction, setSelectedAction] = useState<string>('follow-up');
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [leadAnalysis, setLeadAnalysis] = useState<string>('');
  const { toast } = useToast();

  // Custom spinner component
  const Spinner = ({ className }: { className?: string }) => (
    <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-teal-600 w-4 h-4 ${className}`}></div>
  );

  const messageTypes = [
    { id: 'follow-up', label: 'Seguimiento' },
    { id: 'welcome', label: 'Bienvenida' },
    { id: 'proposal', label: 'Propuesta' },
    { id: 'meeting', label: 'Reunión' },
    { id: 'custom', label: 'Personalizado' }
  ];

  const { generateMessage, analyzeLead, isLoading: isGeminiLoading } = useGemini();
  
  const handleGenerateMessage = async () => {
    if (!leadId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un lead primero",
        variant: "destructive"
      });
      return;
    }

    try {
      const message = await generateMessage(leadId, selectedAction);
      setGeneratedMessage(message);
      toast({
        title: "Mensaje generado",
        description: "Se ha generado un mensaje con IA",
      });
    } catch (error) {
      console.error("Error generando mensaje:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el mensaje. Intenta de nuevo más tarde.",
        variant: "destructive"
      });
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

    try {
      const analysis = await analyzeLead(leadId);
      setLeadAnalysis(analysis);
      toast({
        title: "Análisis completado",
        description: "Se ha realizado el análisis del lead con IA",
      });
    } catch (error) {
      console.error("Error analizando lead:", error);
      toast({
        title: "Error",
        description: "No se pudo analizar el lead. Intenta de nuevo más tarde.",
        variant: "destructive"
      });
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
          <Brain size={20} />
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
              <MessageSquare size={16} className="mr-2" />
              Generar Mensaje
            </TabsTrigger>
            <TabsTrigger value="analyze" className="flex-1">
              <Sparkles size={16} className="mr-2" />
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
                disabled={isGeminiLoading || !leadId}
                className="w-full"
              >
                {isGeminiLoading ? <Spinner className="mr-2" /> : <RotateCw size={16} className="mr-2" />}
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
                  <Send size={16} className="mr-2" />
                  Usar este mensaje
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="analyze" className="mt-4">
            <Button 
              onClick={handleAnalyzeLead} 
              disabled={isGeminiLoading || !leadId}
              className="w-full mb-4"
            >
              {isGeminiLoading ? <Spinner className="mr-2" /> : <Sparkles size={16} className="mr-2" />}
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