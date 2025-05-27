import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, Sparkles, Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface IndependentAgentSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMessage: any;
  chatId: string;
}

interface ExternalAgent {
  id: string;
  name: string;
  agentUrl: string;
  isActive: boolean;
  responseCount: number;
}

const predefinedAgents: ExternalAgent[] = [
  {
    id: '1',
    name: 'Smartbots',
    agentUrl: 'https://chatgpt.com/g/g-6761df4a6ac88191ad4b7f56a0a2f8eb-smartbots',
    isActive: true,
    responseCount: 245
  },
  {
    id: '2', 
    name: 'Smartplanner IA',
    agentUrl: 'https://chatgpt.com/g/g-6761df4a6ac88191ad4b7f56a0a2f8eb-smartplanner-ia',
    isActive: true,
    responseCount: 189
  },
  {
    id: '3',
    name: 'Smartflyer IA',
    agentUrl: 'https://chatgpt.com/g/g-6761df4a6ac88191ad4b7f56a0a2f8eb-smartflyer-ia', 
    isActive: true,
    responseCount: 156
  },
  {
    id: '4',
    name: 'Agente de Ventas de Telca Panama',
    agentUrl: 'https://chatgpt.com/g/g-6761df4a6ac88191ad4b7f56a0a2f8eb-agente-de-ventas-de-telca-panama',
    isActive: true,
    responseCount: 98
  },
  {
    id: '5',
    name: 'Asistente Técnico en Gestión en Campo',
    agentUrl: 'https://chatgpt.com/g/g-6761df4a6ac88191ad4b7f56a0a2f8eb-asistente-tecnico-en-gestion-en-campo',
    isActive: true,
    responseCount: 67
  }
];

export function IndependentAgentSelector({ isOpen, onClose, selectedMessage, chatId }: IndependentAgentSelectorProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResponse, setGeneratedResponse] = useState<string>('');
  const { toast } = useToast();

  const selectedAgent = predefinedAgents.find(agent => agent.id === selectedAgentId);

  const handleGenerateResponse = async () => {
    if (!selectedAgent || !selectedMessage) {
      toast({
        title: 'Error',
        description: 'Selecciona un agente y asegúrate de que hay un mensaje disponible',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedResponse('');

    try {
      const response = await fetch('/api/independent-agent/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
          agentUrl: selectedAgent.agentUrl,
          message: selectedMessage.body,
          chatId: chatId
        })
      });

      if (!response.ok) {
        throw new Error('Error al generar la respuesta');
      }

      const data = await response.json();
      
      if (data.success) {
        setGeneratedResponse(data.response);
        toast({
          title: 'Respuesta generada',
          description: `${selectedAgent.name} ha generado una respuesta exitosamente`,
        });
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error generating response:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar la respuesta del agente',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setSelectedAgentId('');
    setGeneratedResponse('');
    setIsGenerating(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Selector de Agentes Independiente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Message Context */}
          {selectedMessage && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Mensaje a procesar:
              </h3>
              <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                {selectedMessage.body}
              </p>
            </div>
          )}

          {/* Agent Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Seleccionar Agente IA:
            </label>
            
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un agente para generar la respuesta..." />
              </SelectTrigger>
              <SelectContent>
                {predefinedAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{agent.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {agent.responseCount} respuestas
                        </Badge>
                        {agent.isActive && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Agent Info */}
          <AnimatePresence>
            {selectedAgent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-blue-50 rounded-lg p-4 border border-blue-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-blue-900">{selectedAgent.name}</h3>
                  <Badge className="bg-blue-500 text-white">Activo</Badge>
                </div>
                <p className="text-sm text-blue-700">
                  Este agente ha generado {selectedAgent.responseCount} respuestas exitosas
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate Button */}
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateResponse}
              disabled={!selectedAgent || !selectedMessage || isGenerating}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando respuesta...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generar Respuesta
                </>
              )}
            </Button>
            
            {(selectedAgentId || generatedResponse) && (
              <Button variant="outline" onClick={handleReset}>
                Limpiar
              </Button>
            )}
          </div>

          {/* Generated Response */}
          <AnimatePresence>
            {generatedResponse && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-3"
              >
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-green-600" />
                  Respuesta generada por {selectedAgent?.name}:
                </h3>
                
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-green-800 whitespace-pre-wrap">
                    {generatedResponse}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      // Aquí podrías implementar enviar la respuesta al chat
                      toast({
                        title: 'Función pendiente',
                        description: 'La función de envío automático estará disponible próximamente',
                      });
                    }}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Enviar al Chat
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedResponse);
                      toast({
                        title: 'Copiado',
                        description: 'Respuesta copiada al portapapeles',
                      });
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}